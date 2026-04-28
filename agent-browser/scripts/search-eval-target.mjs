import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const defaultRuntime = path.join(__dirname, 'search-eval-target-runtime.ts');

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
const viteNodeBin = path.join(repoRoot, 'node_modules/vite-node/vite-node.mjs');
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
