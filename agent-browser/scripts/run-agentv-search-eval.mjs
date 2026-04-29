import { spawn } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import './agentv-listener-budget.mjs';
import { writeSearchEvalCases } from './generate-search-eval-cases.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..');

export function buildAgentvSearchEvalCommand({ live = false } = {}) {
  return {
    packageName: 'agentv',
    cwd: repoRoot,
    args: [
      'eval',
      'run',
      live
        ? 'agent-browser/evals/search-fulfillment/EVAL.live.yaml'
        : 'agent-browser/evals/search-fulfillment/EVAL.yaml',
      '--target',
      live ? 'agent-browser-search-fulfillment-live' : 'agent-browser-search-fulfillment',
      '--output',
      live ? 'output/evals/search-fulfillment-agentv-live' : 'output/evals/search-fulfillment-agentv',
      '--threshold',
      '0.8',
      '--workers',
      '1',
    ],
  };
}

function buildAgentvEnvironment() {
  const listenerBudgetPreload = pathToFileURL(path.join(__dirname, 'agentv-listener-budget.mjs')).href;
  const nodeOptions = [
    process.env.NODE_OPTIONS,
    `--import=${listenerBudgetPreload}`,
  ].filter(Boolean).join(' ');
  return {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
  };
}

async function resolvePackageBin(packageName) {
  const requireFromApp = createRequire(path.join(appRoot, 'package.json'));
  const packageJsonPath = requireFromApp.resolve(`${packageName}/package.json`);
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const defaultBinName = packageName.split('/').pop();
  const binRelativePath = typeof packageJson.bin === 'string'
    ? packageJson.bin
    : packageJson.bin?.[packageName] ?? packageJson.bin?.[defaultBinName] ?? Object.values(packageJson.bin ?? {})[0];
  if (!binRelativePath) {
    throw new Error(`${packageName} does not declare a runnable bin entry.`);
  }
  return path.resolve(path.dirname(packageJsonPath), binRelativePath);
}

async function runAgentvSearchEval() {
  const live = process.argv.includes('--live');
  await writeSearchEvalCases();
  const command = buildAgentvSearchEvalCommand({ live });
  const binPath = await resolvePackageBin(command.packageName);
  const outputIndex = command.args.indexOf('--output');
  if (outputIndex >= 0) {
    const outputDir = path.resolve(command.cwd, command.args[outputIndex + 1]);
    await rm(outputDir, { recursive: true, force: true });
  }
  const child = spawn(process.execPath, [binPath, ...command.args], {
    cwd: command.cwd,
    env: buildAgentvEnvironment(),
    stdio: 'inherit',
  });

  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command.packageName} exited by signal ${signal}.`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command.packageName} exited with code ${code ?? 'unknown'}.`));
        return;
      }
      resolve();
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runAgentvSearchEval();
}
