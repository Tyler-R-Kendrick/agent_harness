import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePackageBin } from './search-eval-target.mjs';

const APP_TEST_FILES = ['src/App.smoke.test.tsx'];

function defaultReportsDirectory() {
  return process.env.AGENT_BROWSER_COVERAGE_DIR
    ?? path.join(tmpdir(), 'agent-browser-coverage', `agent-browser-${process.pid}`);
}

export function chunkTestFiles(files, chunkSize) {
  const size = Math.max(1, chunkSize);
  const chunks = [];
  for (let index = 0; index < files.length; index += size) {
    chunks.push(files.slice(index, index + size));
  }
  return chunks;
}

export async function findTestFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findTestFiles(entryPath, root));
      continue;
    }
    if (!/\.(test)\.(ts|tsx)$/.test(entry.name)) continue;
    const relativePath = `src/${path.relative(root, entryPath).split(path.sep).join('/')}`;
    if (APP_TEST_FILES.includes(relativePath)) continue;
    files.push(relativePath);
  }
  return files.sort();
}

export function buildVitestCoverageArgs(
  extraArgs = [],
  reportsDirectory = defaultReportsDirectory(),
) {
  const reporterArgs = extraArgs.some((arg) => arg === '--reporter' || arg.startsWith('--reporter='))
    ? []
    : ['--reporter=dot'];
  return [
    'run',
    '--coverage',
    '--coverage.processingConcurrency=1',
    `--coverage.reportsDirectory=${reportsDirectory}`,
    '--no-file-parallelism',
    '--maxWorkers=1',
    ...APP_TEST_FILES.flatMap((filePath) => ['--exclude', filePath]),
    ...reporterArgs,
    ...extraArgs,
  ];
}

export function buildAppTestArgs() {
  return [
    'run',
    '--no-file-parallelism',
    '--maxWorkers=1',
    '--reporter=dot',
    ...APP_TEST_FILES,
  ];
}

export function isVitestCoverageTmpCleanupRace({ exitCode, output }) {
  if (exitCode === 0) return false;
  const text = String(output ?? '');
  const completedTests = /Test Files\s+\d+\s+passed\s+\(\d+\)/.test(text)
    && /Tests\s+\d+\s+passed\s+\(\d+\)/.test(text);
  const completedCoverage = /Coverage summary/.test(text);
  const printedCoverageReport = /Coverage report from v8/.test(text);
  const failedTests = /(?:Test Files|Tests)\s+.*\bfailed\b/i.test(text) || /\bFAIL\b/.test(text);
  const coverageTmpPath = /coverage(?:[\\/][^'"\s]+)*[\\/]\.tmp/i;
  const coverageTmpMissing = (/(?:ENOENT|Something removed the coverage directory)/i.test(text)
    && coverageTmpPath.test(text));
  const coverageReporterCrash = completedTests
    && printedCoverageReport
    && !failedTests
    && (exitCode === -1 || exitCode === 4294967295);

  return (completedTests && completedCoverage && !failedTests && coverageTmpMissing)
    || coverageReporterCrash;
}

async function runVitestCoverage(extraArgs = process.argv.slice(2)) {
  const vitestBin = await resolvePackageBin('vitest');
  if (extraArgs.length > 0) {
    const exitCode = await runVitestCommand(vitestBin, buildVitestCoverageArgs(extraArgs), 'Vitest coverage');
    return exitCode;
  }

  const reportsDirectory = defaultReportsDirectory();
  const chunkSize = Number(process.env.AGENT_BROWSER_COVERAGE_CHUNK_SIZE ?? 3);
  const testChunks = chunkTestFiles(await findTestFiles(path.resolve(process.cwd(), 'src')), chunkSize);
  for (const [index, files] of testChunks.entries()) {
    console.log(`Vitest coverage chunk ${index + 1}/${testChunks.length}: ${files.join(', ')}`);
    const exitCode = await runVitestCommand(
      vitestBin,
      buildVitestCoverageArgs(files, path.join(reportsDirectory, `chunk-${index + 1}`)),
      `Vitest coverage chunk ${index + 1}/${testChunks.length}`,
    );
    if (exitCode !== 0) return exitCode;
  }

  // App smoke coverage crashes Node's v8 coverage worker on this Windows runner,
  // so keep it in the gate without collecting coverage for that file.
  return runVitestCommand(vitestBin, buildAppTestArgs(), 'Vitest App tests');
}

async function runVitestCommand(vitestBin, args, label) {
  const startedAt = Date.now();
  const heartbeat = setInterval(() => {
    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    console.log(`${label} still running (${elapsedSeconds}s)...`);
  }, 30_000);
  const child = spawn(process.execPath, [vitestBin, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(text);
  });
  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stderr.write(text);
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', (error) => {
      clearInterval(heartbeat);
      reject(error);
    });
    child.on('exit', (code, signal) => {
      clearInterval(heartbeat);
      if (signal) {
        reject(new Error(`vitest exited by signal ${signal}.`));
        return;
      }
      resolve(code ?? 1);
    });
  });

  if (isVitestCoverageTmpCleanupRace({ exitCode, output })) {
    console.warn(`${label} completed; ignoring v8 coverage temporary-directory cleanup race.`);
    return 0;
  }

  return exitCode;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(await runVitestCoverage());
}
