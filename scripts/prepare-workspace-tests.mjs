import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function parseArgs(argv) {
  const workspaceFlag = argv.indexOf('--workspace');
  if (workspaceFlag === -1 || !argv[workspaceFlag + 1]) {
    throw new Error('Usage: node scripts/prepare-workspace-tests.mjs --workspace <workspace> [--runner <package>]');
  }

  const runnerFlag = argv.indexOf('--runner');
  return {
    workspace: argv[workspaceFlag + 1],
    runner: runnerFlag === -1 ? 'vitest' : argv[runnerFlag + 1],
  };
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function packagePathExists(packagePath) {
  try {
    await access(packagePath);
    return true;
  } catch {
    return false;
  }
}

export async function findWorkspacePackage(rootDir, workspace) {
  const rootPackageJson = await readJson(path.join(rootDir, 'package.json'));
  const workspacePatterns = Array.isArray(rootPackageJson.workspaces) ? rootPackageJson.workspaces : [];
  const candidates = new Set([workspace]);

  for (const pattern of workspacePatterns) {
    if (!pattern.includes('*')) {
      candidates.add(pattern);
      continue;
    }

    const [prefix, suffix = ''] = pattern.split('*');
    for (const segment of workspace.split('/')) {
      candidates.add(`${prefix}${segment}${suffix}`);
    }
  }

  for (const candidate of candidates) {
    const packageJsonPath = path.join(rootDir, candidate, 'package.json');
    if (!(await packagePathExists(packageJsonPath))) {
      continue;
    }

    const packageJson = await readJson(packageJsonPath);
    if (candidate === workspace || packageJson.name === workspace) {
      return { packageDir: path.dirname(packageJsonPath), packageJson };
    }
  }

  throw new Error(`Unable to find workspace ${workspace}`);
}

export function packageDeclaresRunner(packageJson, runner) {
  for (const group of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    if (packageJson[group] && packageJson[group][runner]) {
      return true;
    }
  }

  return false;
}

export function canResolveRunner(packageDir, runner) {
  try {
    createRequire(path.join(packageDir, 'package.json')).resolve(`${runner}/package.json`);
    return true;
  } catch {
    return false;
  }
}

export function testRunnerInstallPackages(packageJson, runner) {
  const installPackages = [];
  const dependencyGroups = [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.peerDependencies,
    packageJson.optionalDependencies,
  ];

  for (const dependencies of dependencyGroups) {
    if (!dependencies) {
      continue;
    }

    if (dependencies[runner]) {
      installPackages.push(`${runner}@${dependencies[runner]}`);
    }

    for (const [name, version] of Object.entries(dependencies)) {
      if (name.startsWith(`@${runner}/`)) {
        installPackages.push(`${name}@${version}`);
      }
    }
  }

  return [...new Set(installPackages)];
}

export function installArgs(rootDir, packageDir, installPackages) {
  return [
    'install',
    '--prefix',
    packageDir,
    '--no-save',
    '--no-package-lock',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--prefer-offline',
    '--cache',
    path.join(rootDir, '.npm-cache'),
    ...installPackages,
  ];
}

export function installCommand(rootDir, packageDir, installPackages, platform = process.platform) {
  const args = installArgs(rootDir, packageDir, installPackages);
  if (platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm', ...args],
    };
  }

  return { command: 'npm', args };
}

export async function runInstall(rootDir, packageDir, installPackages, options = {}) {
  const spawnImpl = options.spawnImpl ?? spawn;
  const timeoutMs = options.timeoutMs ?? 180_000;
  const { command, args } = options.commandAndArgs ?? installCommand(rootDir, packageDir, installPackages, options.platform);

  return await new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, {
      cwd: rootDir,
      env: options.env ?? process.env,
      stdio: options.stdio ?? 'inherit',
    });
    const timeout = setTimeout(() => {
      child.kill?.();
      reject(new Error(`${command} install timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const settle = (callback) => {
      clearTimeout(timeout);
      callback();
    };

    child.on('error', (error) => settle(() => reject(error)));
    child.on('exit', (code, signal) => {
      if (signal) {
        settle(() => reject(new Error(`${command} install exited with signal ${signal}`)));
        return;
      }

      if (code !== 0) {
        settle(() => reject(new Error(`${command} install exited with code ${code ?? 1}`)));
        return;
      }

      settle(resolve);
    });
  });
}

export async function prepareWorkspaceTests(rootDir, workspace, runner = 'vitest', options = {}) {
  const { packageDir, packageJson } = await findWorkspacePackage(rootDir, workspace);
  if (!packageDeclaresRunner(packageJson, runner)) {
    throw new Error(`Workspace ${workspace} does not declare ${runner}`);
  }

  const installPackages = testRunnerInstallPackages(packageJson, runner);

  if (canResolveRunner(packageDir, runner)) {
    if (options.log) {
      options.log(`${runner} already available for ${workspace}`);
    }
    return { installed: false, packageDir };
  }

  if (options.log) {
    options.log(`${runner} is missing for ${workspace}; running npm install from ${rootDir}`);
  }
  await runInstall(rootDir, packageDir, installPackages, options);

  if (!canResolveRunner(packageDir, runner)) {
    throw new Error(`${runner} is still unavailable for ${workspace} after npm install`);
  }

  return { installed: true, packageDir };
}

export async function main(argv = process.argv.slice(2), options = {}) {
  const { workspace, runner } = parseArgs(argv);
  await prepareWorkspaceTests(options.rootDir ?? process.cwd(), workspace, runner, options);
}

/* node:coverage disable */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
/* node:coverage enable */
