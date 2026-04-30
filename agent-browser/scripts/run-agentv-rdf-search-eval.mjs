import { spawn } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import './agentv-listener-budget.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..');

export function buildAgentvRdfSearchEvalCommand() {
  const workers = process.env.AGENT_BROWSER_AGENTV_WORKERS ?? '1';
  return {
    packageName: 'agentv',
    cwd: repoRoot,
    args: [
      'eval',
      'run',
      'agent-browser/evals/rdf-web-search-agent/EVAL.yaml',
      '--target',
      'agent-browser-rdf-web-search-agent',
      '--output',
      'output/evals/rdf-web-search-agentv',
      '--threshold',
      '0.85',
      '--workers',
      workers,
    ],
  };
}

export function buildAgentvRdfSearchEvalEnvironment(baseEnv = process.env) {
  const listenerImport = `--import=${pathToFileURL(path.join(__dirname, 'agentv-listener-budget.mjs')).href}`;
  const existingNodeOptions = baseEnv.NODE_OPTIONS ?? '';
  const nodeOptions = existingNodeOptions.includes('agentv-listener-budget.mjs')
    ? existingNodeOptions
    : [existingNodeOptions, listenerImport].filter(Boolean).join(' ');
  return {
    ...baseEnv,
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

async function runAgentvRdfSearchEval() {
  const command = buildAgentvRdfSearchEvalCommand();
  const binPath = await resolvePackageBin(command.packageName);
  const outputIndex = command.args.indexOf('--output');
  if (outputIndex >= 0) {
    const outputDir = path.resolve(command.cwd, command.args[outputIndex + 1]);
    await rm(outputDir, { recursive: true, force: true });
  }
  const child = spawn(process.execPath, [binPath, ...command.args], {
    cwd: command.cwd,
    env: buildAgentvRdfSearchEvalEnvironment(),
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
  await runAgentvRdfSearchEval();
}
