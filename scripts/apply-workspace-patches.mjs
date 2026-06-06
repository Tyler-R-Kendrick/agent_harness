import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const workspacePatches = [
  {
    cwd: '.',
    packagePath: 'node_modules/@tavily/core',
    patchFiles: ['@tavily+core+0.7.3.patch'],
  },
  {
    cwd: '.',
    packagePath: 'node_modules/guidance-ts',
    patchFiles: ['guidance-ts+1.0.0.patch'],
  },
];

export function resolveInstalledPackagePath(rootDir, cwd, packagePath) {
  const packageRelativePath = packagePath.replace(/^node_modules[\\/]/, '');
  const candidates = [
    path.join(rootDir, cwd, packagePath),
    path.join(rootDir, 'node_modules', packageRelativePath),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

export function resolvePatchWorkingDirectory(rootDir, cwd, packagePath) {
  const workspaceDirectory = path.join(rootDir, cwd);
  return path.relative(workspaceDirectory, packagePath).startsWith('..') ? rootDir : workspaceDirectory;
}

function normalizeApplyWorkspacePatchesOptions(options) {
  return typeof options === 'string' ? { rootDir: options } : options;
}

export function applyWorkspacePatches(options = {}) {
  const {
    rootDir = repoRoot,
    patchTargets = workspacePatches,
    spawnSyncImpl = spawnSync,
    log = console.log,
    error = console.error,
    env = process.env,
    nodeExecPath = process.execPath,
  } = normalizeApplyWorkspacePatchesOptions(options);

  for (const patchTarget of patchTargets) {
    const packagePath = resolveInstalledPackagePath(rootDir, patchTarget.cwd, patchTarget.packagePath);
    if (!packagePath) {
      log(`Skipping ${patchTarget.patchFiles.join(', ')} because ${patchTarget.packagePath} is not installed.`);
      continue;
    }

    const cwd = resolvePatchWorkingDirectory(rootDir, patchTarget.cwd, packagePath);
    const patchDir = mkdtempSync(path.join(cwd, '.patches-'));
    const patchDirArg = path.relative(cwd, patchDir).split(path.sep).join('/');
    const patchPackageBin = path
      .relative(cwd, path.join(rootDir, 'scripts', 'run-package-bin.mjs'))
      .split(path.sep)
      .join('/');

    try {
      for (const patchFile of patchTarget.patchFiles) {
        copyFileSync(path.join(rootDir, 'patches', patchFile), path.join(patchDir, patchFile));
      }

      const result = spawnSyncImpl(
        nodeExecPath,
        [
          patchPackageBin,
          'patch-package',
          '--patch-dir',
          patchDirArg,
        ],
        {
          cwd,
          env,
          stdio: 'inherit',
        },
      );

      if (result.error) {
        error(`Failed to apply package patches in ${patchTarget.cwd}`);
        error(result.error.message);
        return 1;
      }

      if (result.status !== 0) {
        return result.status ?? 1;
      }
    } finally {
      rmSync(patchDir, { force: true, recursive: true });
    }
  }

  return 0;
}

/* node:coverage disable */
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = applyWorkspacePatches();
}
/* node:coverage enable */
