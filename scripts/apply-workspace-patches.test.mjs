import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  applyWorkspacePatches,
  resolveInstalledPackagePath,
  resolvePatchWorkingDirectory,
} from './apply-workspace-patches.mjs';

async function createPatchFixture() {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'workspace-patches-'));
  await mkdir(path.join(rootDir, 'patches'), { recursive: true });
  await mkdir(path.join(rootDir, 'scripts'), { recursive: true });
  await writeFile(path.join(rootDir, 'scripts', 'run-package-bin.mjs'), '');
  return rootDir;
}

async function createPackage(rootDir, packagePath) {
  await mkdir(path.join(rootDir, packagePath), { recursive: true });
}

async function listTemporaryPatchDirs(rootDir) {
  return (await readdir(rootDir)).filter((entry) => entry.startsWith('.patches-'));
}

{
  const rootDir = await createPatchFixture();
  await createPackage(rootDir, 'node_modules/hoisted-package');
  await mkdir(path.join(rootDir, 'workspace', 'node_modules', 'local-package'), { recursive: true });

  assert.equal(
    resolveInstalledPackagePath(rootDir, 'workspace', 'node_modules/local-package'),
    path.join(rootDir, 'workspace', 'node_modules', 'local-package'),
  );
  assert.equal(
    resolveInstalledPackagePath(rootDir, 'workspace', 'node_modules/hoisted-package'),
    path.join(rootDir, 'node_modules', 'hoisted-package'),
  );
  assert.equal(
    resolveInstalledPackagePath(rootDir, 'workspace', 'node_modules/missing-package'),
    undefined,
  );
  assert.equal(
    resolvePatchWorkingDirectory(
      rootDir,
      'workspace',
      path.join(rootDir, 'workspace', 'node_modules', 'local-package'),
    ),
    path.join(rootDir, 'workspace'),
  );
  assert.equal(
    resolvePatchWorkingDirectory(rootDir, 'workspace', path.join(rootDir, 'node_modules', 'hoisted-package')),
    rootDir,
  );
}

{
  const rootDir = await createPatchFixture();
  const logs = [];
  const status = applyWorkspacePatches({
    rootDir,
    patchTargets: [{
      cwd: '.',
      packagePath: 'node_modules/missing-package',
      patchFiles: ['missing-package.patch'],
    }],
    log: (message) => logs.push(message),
    spawnSyncImpl: () => {
      throw new Error('spawn should not run for missing packages');
    },
  });

  assert.equal(status, 0);
  assert.deepEqual(logs, [
    'Skipping missing-package.patch because node_modules/missing-package is not installed.',
  ]);
  assert.deepEqual(await listTemporaryPatchDirs(rootDir), []);

  const legacyRootDir = await createPatchFixture();
  const originalConsoleLog = console.log;
  try {
    console.log = () => {};
    assert.equal(applyWorkspacePatches(legacyRootDir), 0);
  } finally {
    console.log = originalConsoleLog;
  }
}

{
  const rootDir = await createPatchFixture();
  await createPackage(rootDir, 'node_modules/example-package');
  await writeFile(path.join(rootDir, 'patches', 'example-package.patch'), 'patch body');

  const calls = [];
  const status = applyWorkspacePatches({
    rootDir,
    patchTargets: [{
      cwd: '.',
      packagePath: 'node_modules/example-package',
      patchFiles: ['example-package.patch'],
    }],
    env: { CUSTOM_ENV: '1' },
    nodeExecPath: '/node',
    spawnSyncImpl: (command, args, options) => {
      calls.push({ command, args, options });
      const patchDirArg = args.at(-1);
      const copiedPatchPath = path.join(options.cwd, patchDirArg, 'example-package.patch');
      assert.equal(readFileSync(copiedPatchPath, 'utf8'), 'patch body');
      return { status: 0 };
    },
  });

  assert.equal(status, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, '/node');
  assert.deepEqual(calls[0].args.slice(0, 3), [
    'scripts/run-package-bin.mjs',
    'patch-package',
    '--patch-dir',
  ]);
  assert.match(calls[0].args[3], /^\.patches-/);
  assert.equal(calls[0].options.cwd, rootDir);
  assert.deepEqual(calls[0].options.env, { CUSTOM_ENV: '1' });
  assert.equal(calls[0].options.stdio, 'inherit');
  assert.equal(existsSync(path.join(rootDir, calls[0].args[3])), false);
  assert.deepEqual(await listTemporaryPatchDirs(rootDir), []);
}

{
  const rootDir = await createPatchFixture();
  await createPackage(rootDir, 'node_modules/error-package');
  await writeFile(path.join(rootDir, 'patches', 'error-package.patch'), 'patch body');
  const errors = [];

  const status = applyWorkspacePatches({
    rootDir,
    patchTargets: [{
      cwd: '.',
      packagePath: 'node_modules/error-package',
      patchFiles: ['error-package.patch'],
    }],
    error: (message) => errors.push(message),
    spawnSyncImpl: () => ({ error: new Error('spawn EPERM') }),
  });

  assert.equal(status, 1);
  assert.deepEqual(errors, [
    'Failed to apply package patches in .',
    'spawn EPERM',
  ]);
  assert.deepEqual(await listTemporaryPatchDirs(rootDir), []);
}

{
  const rootDir = await createPatchFixture();
  await createPackage(rootDir, 'node_modules/failing-package');
  await writeFile(path.join(rootDir, 'patches', 'failing-package.patch'), 'patch body');

  assert.equal(applyWorkspacePatches({
    rootDir,
    patchTargets: [{
      cwd: '.',
      packagePath: 'node_modules/failing-package',
      patchFiles: ['failing-package.patch'],
    }],
    spawnSyncImpl: () => ({ status: 7 }),
  }), 7);

  assert.deepEqual(await listTemporaryPatchDirs(rootDir), []);
}

{
  const rootDir = await createPatchFixture();
  await createPackage(rootDir, 'node_modules/null-status-package');
  await writeFile(path.join(rootDir, 'patches', 'null-status-package.patch'), 'patch body');

  assert.equal(applyWorkspacePatches({
    rootDir,
    patchTargets: [{
      cwd: '.',
      packagePath: 'node_modules/null-status-package',
      patchFiles: ['null-status-package.patch'],
    }],
    spawnSyncImpl: () => ({ status: null }),
  }), 1);

  assert.deepEqual(await listTemporaryPatchDirs(rootDir), []);
}

console.log('workspace patch application regression checks passed');
