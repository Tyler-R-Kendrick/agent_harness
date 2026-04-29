import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const requireFromApp = createRequire(path.join(repoRoot, 'agent-browser/package.json'));
const defaultRuntime = path.join(__dirname, 'search-eval-target-runtime.ts');

async function resolvePackageBin(packageName) {
  const packageJsonPath = requireFromApp.resolve(`${packageName}/package.json`);
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const defaultBinName = packageName.split('/').pop();
  const binRelativePath = typeof packageJson.bin === 'string'
    ? packageJson.bin
    : packageJson.bin?.[packageName] ?? packageJson.bin?.[defaultBinName] ?? Object.values(packageJson.bin ?? {})[0];
  if (!binRelativePath) throw new Error(`${packageName} does not declare a runnable bin entry.`);
  return path.resolve(path.dirname(packageJsonPath), binRelativePath);
}

function readRuntimeArg(args) {
  const index = args.indexOf('--runtime');
  if (index < 0) return { runtime: defaultRuntime, args };
  const runtime = args[index + 1];
  if (!runtime) throw new Error('--runtime requires a script path.');
  return {
    runtime: path.resolve(repoRoot, runtime),
    args: args.toSpliced(index, 2),
  };
}

const { runtime, args } = readRuntimeArg(process.argv.slice(2));
const viteNodeBin = await resolvePackageBin('vite-node');
const child = spawn(process.execPath, [viteNodeBin, runtime, ...args], {
  cwd: repoRoot,
  env: process.env,
  stdio: 'inherit',
});

await new Promise((resolve, reject) => {
  child.on('error', reject);
  child.on('exit', (code, signal) => {
    if (signal) {
      reject(new Error(`search-eval-target-runtime.ts exited by signal ${signal}.`));
      return;
    }
    if (code !== 0) {
      reject(new Error(`search-eval-target-runtime.ts exited with code ${code ?? 'unknown'}.`));
      return;
    }
    resolve(undefined);
  });
});
