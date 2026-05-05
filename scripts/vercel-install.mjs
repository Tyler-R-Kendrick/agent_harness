import { spawn } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function getNpmExecutable(platform = process.platform) {
  return platform === 'win32' ? 'npm.cmd' : 'npm';
}

export function buildInstallSteps(npmExecutable = getNpmExecutable()) {
  return [
    [npmExecutable, ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--loglevel=error']],
    [npmExecutable, ['ci', '--no-audit', '--loglevel=error']],
    [npmExecutable, ['audit', '--audit-level=moderate']],
  ];
}

export function usesShellForPlatform(platform = process.platform) {
  return platform === 'win32';
}

export async function getCachedInstallArtifactPaths(rootDir = process.cwd()) {
  const paths = [
    path.join(rootDir, 'package-lock.json'),
    path.join(rootDir, 'node_modules'),
    path.join(rootDir, 'agent-browser', 'package-lock.json'),
    path.join(rootDir, 'agent-browser', 'node_modules'),
    path.join(rootDir, 'harness-core', 'node_modules'),
  ];

  await appendNestedWorkspaceNodeModules(paths, rootDir, 'lib');
  await appendNestedWorkspaceNodeModules(paths, rootDir, 'ext');

  return paths;
}

async function appendNestedWorkspaceNodeModules(paths, rootDir, workspaceRoot) {
  try {
    const entries = await readdir(path.join(rootDir, workspaceRoot), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        paths.push(path.join(rootDir, workspaceRoot, entry.name, 'node_modules'));
      }
    }
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }
}

export async function removeCachedInstallArtifacts(rootDir = process.cwd()) {
  const paths = await getCachedInstallArtifactPaths(rootDir);
  await Promise.all(paths.map((artifactPath) => rm(artifactPath, { force: true, recursive: true })));
}

export async function removeCachedLockfiles(rootDir = process.cwd()) {
  await removeCachedInstallArtifacts(rootDir);
}

function runStep(command, args, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      shell: usesShellForPlatform(),
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} ${args.join(' ')} exited with signal ${signal}`));
        return;
      }

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 1}`));
    });
  });
}

export async function runVercelInstall(rootDir = process.cwd()) {
  await removeCachedInstallArtifacts(rootDir);

  for (const [command, args] of buildInstallSteps()) {
    await runStep(command, args, rootDir);
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;

if (entrypoint === import.meta.url) {
  runVercelInstall(path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)))).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
