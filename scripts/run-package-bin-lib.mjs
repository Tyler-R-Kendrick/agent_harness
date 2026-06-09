import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function errorCauseMessage(error) {
  if (!(error instanceof Error) || !error.cause) {
    return undefined;
  }

  return error.cause instanceof Error ? error.cause.message : String(error.cause);
}

export function selectPackageBinPath(packageName, packageJson) {
  const { bin } = packageJson;
  if (typeof bin === 'string') {
    return bin;
  }

  if (!bin || typeof bin !== 'object') {
    return undefined;
  }

  const defaultBinName = packageName.split('/').pop();
  const entries = Object.entries(bin).filter(([, value]) => typeof value === 'string');
  return bin[packageName] ?? (defaultBinName ? bin[defaultBinName] : undefined) ?? entries[0]?.[1];
}

export function resolvePackageBinPath(packageJsonPath, binRelativePath, packageName) {
  if (typeof binRelativePath !== 'string' || binRelativePath.trim().length === 0) {
    throw new Error(`Package ${packageName} does not declare a runnable bin entry`);
  }

  const packageDirectory = path.dirname(packageJsonPath);
  const binPath = path.resolve(packageDirectory, binRelativePath);
  const relativeBinPath = path.relative(packageDirectory, binPath);
  if (relativeBinPath.startsWith('..') || path.isAbsolute(relativeBinPath)) {
    throw new Error(`Package ${packageName} declares a bin path outside its package directory`);
  }

  return binPath;
}

export async function resolvePackageBin(packageName, requireFromPackage, cwd = process.cwd()) {
  if (!packageName) {
    throw new Error('Usage: node scripts/run-package-bin.mjs <package-name> [args...]');
  }

  const requireFromCwd = requireFromPackage ?? createRequire(path.join(cwd, 'package.json'));
  let packageJsonPath;

  try {
    packageJsonPath = requireFromCwd.resolve(`${packageName}/package.json`);
  } catch (error) {
    throw new Error(`Unable to resolve ${packageName} from ${cwd}`, { cause: error });
  }

  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  return resolvePackageBinPath(packageJsonPath, selectPackageBinPath(packageName, packageJson), packageName);
}

/* node:coverage disable */
export async function runPackageBin(packageName, args, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const binPath = await resolvePackageBin(packageName, options.requireFromPackage, cwd);
  const spawnImpl = options.spawnImpl ?? spawn;
  const exit = options.exit ?? process.exit;
  const kill = options.kill ?? process.kill;
  const logError = options.logError ?? console.error;
  const child = spawnImpl(process.execPath, [binPath, ...args], {
    cwd,
    env: options.env ?? process.env,
    stdio: options.stdio ?? 'inherit',
  });

  child.on('error', (error) => {
    logError(`Failed to start ${packageName}`);
    logError(errorMessage(error));
    exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      kill(process.pid, signal);
      return;
    }

    exit(code ?? 1);
  });
}

export async function main(argv = process.argv, options = {}) {
  const [, , packageName, ...args] = argv;
  try {
    await runPackageBin(packageName, args, options);
  } catch (error) {
    const logError = options.logError ?? console.error;
    const exit = options.exit ?? process.exit;
    logError(errorMessage(error));
    const cause = errorCauseMessage(error);
    if (cause) {
      logError(cause);
    }
    exit(1);
  }
}
/* node:coverage enable */
