import { spawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_EXTENSIONS_DIRECTORY = 'ext';

function repoRootFromScript() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function npmExecutable() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

export function normalizeRequestedScripts(args) {
  if (!args.length) {
    throw new Error('At least one extension script must be provided.');
  }
  return args;
}

export function buildWorkspaceScriptArgs(workspaceName, scriptName) {
  return ['--workspace', workspaceName, 'run', scriptName];
}

export async function discoverExtensionWorkspaces(repoRoot = repoRootFromScript()) {
  const extensionRoot = path.join(repoRoot, DEFAULT_EXTENSIONS_DIRECTORY);
  const workspaces = [];

  async function visit(directory) {
    try {
      const packageJson = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
      if (typeof packageJson.name === 'string') {
        workspaces.push({ name: packageJson.name, directory });
        return;
      }
    } catch (error) {
      if (!error || typeof error !== 'object' || error.code !== 'ENOENT') {
        throw error;
      }
    }

    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await visit(path.join(directory, entry.name));
      }
    }
  }

  const entries = await readdir(extensionRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    await visit(path.join(extensionRoot, entry.name));
  }
  return workspaces.sort((left, right) => left.name.localeCompare(right.name));
}

async function runWorkspaceScript(workspaceName, scriptName, cwd) {
  const command = npmExecutable();
  const args = buildWorkspaceScriptArgs(workspaceName, scriptName);
  console.log(`extension ${workspaceName}: npm ${args.join(' ')}`);
  const startedAt = Date.now();
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${workspaceName} ${scriptName} exited by signal ${signal}.`));
        return;
      }
      resolve(code ?? 1);
    });
  });
  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`extension ${workspaceName}: ${scriptName} finished in ${elapsedSeconds}s`);
  return exitCode;
}

async function main() {
  const repoRoot = repoRootFromScript();
  const scripts = normalizeRequestedScripts(process.argv.slice(2));
  const workspaces = await discoverExtensionWorkspaces(repoRoot);
  if (!workspaces.length) {
    throw new Error('No extension workspaces found under ext/.');
  }

  for (const scriptName of scripts) {
    for (const workspace of workspaces) {
      const exitCode = await runWorkspaceScript(workspace.name, scriptName, repoRoot);
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
