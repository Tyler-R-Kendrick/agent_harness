import { spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const agentBrowserRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(agentBrowserRoot, '..');
const outDir = path.join(repoRoot, 'output', 'context-manager-smoke');
const compiledDir = path.join(outDir, 'compiled');
const entryPath = path.join(agentBrowserRoot, 'scripts', 'context-manager-smoke-entry.ts');
const viteEnvPath = path.join(agentBrowserRoot, 'src', 'vite-env.d.ts');
const tscPath = require.resolve('typescript/bin/tsc');

await rm(outDir, { recursive: true, force: true });
await mkdir(compiledDir, { recursive: true });
await writeFile(path.join(compiledDir, 'package.json'), '{"type":"commonjs"}\n');

const tsc = spawnSync(process.execPath, [
  tscPath,
  viteEnvPath,
  entryPath,
  '--target', 'ES2022',
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--lib', 'ES2023,DOM,DOM.Iterable,WebWorker',
  '--jsx', 'react-jsx',
  '--esModuleInterop',
  '--skipLibCheck',
  '--strict',
  '--types', 'node',
  '--rootDir', agentBrowserRoot,
  '--outDir', compiledDir,
  '--noEmitOnError', 'true',
], {
  cwd: repoRoot,
  env: process.env,
  encoding: 'utf8',
});

if (tsc.status !== 0) {
  process.stderr.write(tsc.stdout);
  process.stderr.write(tsc.stderr);
  process.exit(tsc.status ?? 1);
}

const node = spawnSync(process.execPath, [
  path.join(compiledDir, 'scripts', 'context-manager-smoke-entry.js'),
], {
  cwd: repoRoot,
  env: process.env,
  encoding: 'utf8',
});

process.stdout.write(node.stdout);
process.stderr.write(node.stderr);
process.exit(node.status ?? 0);
