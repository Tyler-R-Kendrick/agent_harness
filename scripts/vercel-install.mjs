import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function getNpmExecutable(platform = process.platform) {
  return platform === 'win32' ? 'npm.cmd' : 'npm';
}

export function buildInstallSteps(npmExecutable = getNpmExecutable()) {
  return [
    [npmExecutable, ['install', '--package-lock-only', '--ignore-scripts']],
    [npmExecutable, ['ci']],
  ];
}

export function usesShellForPlatform(platform = process.platform) {
  return platform === 'win32';
}

export async function removeCachedLockfiles(rootDir = process.cwd()) {
  await Promise.all([
    rm(path.join(rootDir, 'package-lock.json'), { force: true }),
    rm(path.join(rootDir, 'agent-browser', 'package-lock.json'), { force: true }),
  ]);
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
  await removeCachedLockfiles(rootDir);

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
