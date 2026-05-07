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

export function applyWorkspacePatches(rootDir = repoRoot) {
  for (const patchTarget of workspacePatches) {
    const packagePath = resolveInstalledPackagePath(rootDir, patchTarget.cwd, patchTarget.packagePath);
    if (!packagePath) {
      console.log(`Skipping ${patchTarget.patchFiles.join(', ')} because ${patchTarget.packagePath} is not installed.`);
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

      const result = spawnSync(
        process.execPath,
        [
          patchPackageBin,
          'patch-package',
          '--patch-dir',
          patchDirArg,
        ],
        {
          cwd,
          env: process.env,
          stdio: 'inherit',
        },
      );

      if (result.error) {
        console.error(`Failed to apply package patches in ${patchTarget.cwd}`);
        console.error(result.error.message);
        process.exit(1);
      }

      if (result.status !== 0) {
        process.exit(result.status ?? 1);
      }
    } finally {
      rmSync(patchDir, { force: true, recursive: true });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  applyWorkspacePatches();
}
