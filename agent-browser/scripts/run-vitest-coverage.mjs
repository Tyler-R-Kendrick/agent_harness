import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePackageBin } from './search-eval-target.mjs';

const DEFAULT_COVERAGE_SHARD_COUNT = 8;
const DEFAULT_COVERAGE_BATCH_CONCURRENCY = 4;
const APP_TEST_FILES = ['src/App.integration.test.tsx', 'src/App.smoke.test.tsx'];
const COVERAGE_TEST_ROOTS = ['src', 'server'];
const COVERAGE_BATCH_SIZE = 25;
const TEST_FILE_PATTERN = /\.test\.(?:ts|tsx)$/;

function defaultReportsDirectory() {
  return process.env.AGENT_BROWSER_COVERAGE_DIR
    ?? path.join(tmpdir(), 'agent-browser-coverage', `agent-browser-${process.pid}`);
}

export function buildVitestCoverageArgs(
  extraArgs = [],
  reportsDirectory = defaultReportsDirectory(),
  testFiles = [],
) {
  const reporterArgs = extraArgs.some((arg) => arg === '--reporter' || arg.startsWith('--reporter='))
    ? []
    : ['--reporter=dot'];
  return [
    'run',
    '--configLoader=native',
    '--coverage',
    '--coverage.processingConcurrency=1',
    '--coverage.reporter=text-summary',
    `--coverage.reportsDirectory=${reportsDirectory}`,
    '--no-file-parallelism',
    '--maxWorkers=1',
    '--pool=forks',
    '--teardownTimeout=60000',
    ...APP_TEST_FILES.flatMap((filePath) => ['--exclude', filePath]),
    ...reporterArgs,
    ...extraArgs,
    ...testFiles,
  ];
}

export function buildAppTestArgs() {
  return [
    'run',
    '--configLoader=native',
    '--no-file-parallelism',
    '--maxWorkers=1',
    '--pool=forks',
    '--teardownTimeout=60000',
    '--reporter=dot',
    ...APP_TEST_FILES,
  ];
}

export function buildVitestCoverageShardRuns(
  shardCount = DEFAULT_COVERAGE_SHARD_COUNT,
  reportsDirectory = defaultReportsDirectory(),
) {
  return Array.from({ length: shardCount }, (_, index) => {
    const shardIndex = index + 1;
    return {
      label: `Vitest coverage shard ${shardIndex}/${shardCount}`,
      args: buildVitestCoverageArgs(
        [`--shard=${shardIndex}/${shardCount}`],
        path.join(reportsDirectory, `shard-${shardIndex}`),
      ),
    };
  });
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

export function chunkTestFiles(files, batchSize = COVERAGE_BATCH_SIZE) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new TypeError('Coverage batch size must be a positive integer.');
  }

  const chunks = [];
  for (let index = 0; index < files.length; index += batchSize) {
    chunks.push(files.slice(index, index + batchSize));
  }
  return chunks;
}

export async function discoverCoverageTestFiles(cwd = process.cwd()) {
  const files = [];
  for (const root of COVERAGE_TEST_ROOTS) {
    await collectTestFiles(path.join(cwd, root), root, files);
  }
  return files
    .filter((filePath) => !APP_TEST_FILES.includes(filePath))
    .sort((left, right) => left.localeCompare(right));
}

async function collectTestFiles(absoluteDirectory, relativeDirectory, files) {
  let entries;
  try {
    entries = await readdir(absoluteDirectory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory.replaceAll(path.sep, '/'), entry.name);
    const absolutePath = path.join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      await collectTestFiles(absolutePath, relativePath, files);
      continue;
    }
    if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
      files.push(relativePath);
    }
  }
}

async function runVitestCoverage(extraArgs = process.argv.slice(2)) {
  const vitestBin = await resolvePackageBin('vitest');
  if (extraArgs.length > 0) {
    return runVitestCommandWithRetry(vitestBin, buildVitestCoverageArgs(extraArgs), 'Vitest coverage');
  }

  const reportsDirectory = defaultReportsDirectory();
  const coverageTestFiles = await discoverCoverageTestFiles();
  const coverageBatches = chunkTestFiles(coverageTestFiles);
  const coverageExitCode = await runVitestCommandsConcurrently(
    vitestBin,
    coverageBatches.map((files, index) => ({
      label: `Vitest coverage batch ${index + 1}/${coverageBatches.length}`,
      args: buildVitestCoverageArgs([], path.join(reportsDirectory, `batch-${index + 1}`), files),
    })),
    DEFAULT_COVERAGE_BATCH_CONCURRENCY,
  );
  if (coverageExitCode !== 0) {
    return coverageExitCode;
  }

  // App UI suites crash Node's v8 coverage worker on this Windows runner,
  // so keep them in the gate without collecting coverage for those files.
  return runVitestCommandWithRetry(vitestBin, buildAppTestArgs(), 'Vitest App tests');
}

export async function runVitestCommandsConcurrently(vitestBin, runs, concurrency = DEFAULT_COVERAGE_BATCH_CONCURRENCY) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError('Coverage batch concurrency must be a positive integer.');
  }
  let nextIndex = 0;
  let firstFailure = 0;
  const workerCount = Math.min(concurrency, runs.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < runs.length) {
      const run = runs[nextIndex];
      nextIndex += 1;
      const exitCode = await runVitestCommandWithRetry(vitestBin, run.args, run.label);
      if (exitCode !== 0 && firstFailure === 0) {
        firstFailure = exitCode;
      }
    }
  }));
  return firstFailure;
}

async function runVitestCommandWithRetry(vitestBin, args, label, maxAttempts = 2) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const attemptLabel = attempt === 1 ? label : `${label} retry ${attempt}/${maxAttempts}`;
    const exitCode = await runVitestCommand(vitestBin, args, attemptLabel);
    if (exitCode === 0 || attempt === maxAttempts) {
      return exitCode;
    }
    console.warn(`${label} failed with exit code ${exitCode}; retrying once.`);
  }
  return 1;
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

  if (exitCode !== 0) {
    console.error(`${label} failed with exit code ${exitCode}.`);
  }

  return exitCode;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(await runVitestCoverage());
}
