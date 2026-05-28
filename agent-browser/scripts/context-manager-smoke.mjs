import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { resolvePackageBin } from './search-eval-target.mjs';

const agentBrowserRoot = path.resolve(import.meta.dirname, '..');
const entryPath = path.join(agentBrowserRoot, 'scripts', 'context-manager-smoke-entry.ts');
const configPath = path.join(agentBrowserRoot, 'vite.config.ts');
const viteNodePath = await resolvePackageBin('vite-node');

const node = spawnSync(process.execPath, [
  viteNodePath,
  '--config',
  configPath,
  '--script',
  entryPath,
], {
  cwd: agentBrowserRoot,
  env: process.env,
  encoding: 'utf8',
});

process.stdout.write(node.stdout);
process.stderr.write(node.stderr);
process.exit(node.status ?? 0);
