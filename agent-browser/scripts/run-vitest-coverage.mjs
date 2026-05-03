import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePackageBin } from './search-eval-target.mjs';

const APP_TEST_FILES = ['src/App.smoke.test.tsx'];

function defaultReportsDirectory() {
  return process.env.AGENT_BROWSER_COVERAGE_DIR
    ?? path.join(tmpdir(), 'agent-browser-coverage', `agent-browser-${process.pid}`);
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
    ...APP_TEST_FILES.flatMap((filePath) => ['--exclude', filePath]),
    ...reporterArgs,
    ...extraArgs,
  ];
}

export function buildAppTestArgs() {
  return [
    'run',
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
  const failedTests = /(?:Test Files|Tests)\s+.*\bfailed\b/i.test(text) || /\bFAIL\b/.test(text);
  const coverageTmpPath = /coverage(?:[\\/][^'"\s]+)*[\\/]\.tmp/i;
  const coverageTmpMissing = (/(?:ENOENT|Something removed the coverage directory)/i.test(text)
    && coverageTmpPath.test(text));

  return completedTests && completedCoverage && !failedTests && coverageTmpMissing;
}

async function runVitestCoverage(extraArgs = process.argv.slice(2)) {
  const vitestBin = await resolvePackageBin('vitest');
  const exitCode = await runVitestCommand(vitestBin, buildVitestCoverageArgs(extraArgs), 'Vitest coverage');
  if (exitCode !== 0 || extraArgs.length > 0) {
    return exitCode;
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
    stdio: 'inherit',
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

  return exitCode;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(await runVitestCoverage());
}
