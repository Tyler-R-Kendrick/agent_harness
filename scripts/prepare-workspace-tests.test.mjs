import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  findWorkspacePackage,
  installCommand,
  installArgs,
  main,
  packageDeclaresRunner,
  parseArgs,
  prepareWorkspaceTests,
  runInstall,
  testRunnerInstallPackages,
} from './prepare-workspace-tests.mjs';

async function writePackage(rootDir, relativeDir, packageJson) {
  const packageDir = path.join(rootDir, relativeDir);
  await mkdir(packageDir, { recursive: true });
  await writeFile(path.join(packageDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  return packageDir;
}

function createSpawnStub({ onSpawn } = {}) {
  const calls = [];
  const spawnImpl = (...args) => {
    calls.push(args);
    const child = new EventEmitter();
    queueMicrotask(async () => {
      await onSpawn?.();
      child.emit('exit', 0, null);
    });
    return child;
  };
  return { calls, spawnImpl };
}

test('parseArgs requires a workspace', () => {
  assert.throws(() => parseArgs([]), /Usage:/);
  assert.throws(() => parseArgs(['--workspace']), /Usage:/);
  assert.deepEqual(parseArgs(['--workspace', '@agent-harness/git-stub']), {
    workspace: '@agent-harness/git-stub',
    runner: 'vitest',
  });
  assert.deepEqual(parseArgs(['--runner', 'playwright', '--workspace', 'agent-browser']), {
    workspace: 'agent-browser',
    runner: 'playwright',
  });
});

test('findWorkspacePackage resolves workspace names through root workspace globs', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'prepare-workspace-tests-'));
  await writePackage(rootDir, '.', { workspaces: ['packages/*/src', 'lib/*'] });
  await writePackage(rootDir, 'lib/git-stub', {
    name: '@agent-harness/git-stub',
    devDependencies: { vitest: '^4.1.5' },
  });

  const found = await findWorkspacePackage(rootDir, '@agent-harness/git-stub');

  assert.equal(found.packageDir, path.join(rootDir, 'lib/git-stub'));
});

test('findWorkspacePackage resolves literal workspace paths and rejects missing workspaces', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'prepare-workspace-tests-'));
  await writePackage(rootDir, '.', { workspaces: ['harness-core'] });
  await writePackage(rootDir, 'harness-core', {
    name: 'harness-core',
    devDependencies: { vitest: '^4.1.5' },
  });

  const found = await findWorkspacePackage(rootDir, 'harness-core');

  assert.equal(found.packageDir, path.join(rootDir, 'harness-core'));
  await assert.rejects(() => findWorkspacePackage(rootDir, 'missing-workspace'), /Unable to find workspace/);
});

test('findWorkspacePackage handles roots without workspace metadata and skips name mismatches', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'prepare-workspace-tests-'));
  await writePackage(rootDir, '.', {});

  await assert.rejects(() => findWorkspacePackage(rootDir, 'lib/git-stub'), /Unable to find workspace/);

  await writePackage(rootDir, '.', { workspaces: ['lib/*'] });
  await writePackage(rootDir, 'lib/git-stub', { name: 'different-name' });

  await assert.rejects(() => findWorkspacePackage(rootDir, '@agent-harness/git-stub'), /Unable to find workspace/);
});

test('packageDeclaresRunner checks all package dependency groups', () => {
  assert.equal(packageDeclaresRunner({ devDependencies: { vitest: '^4.1.5' } }, 'vitest'), true);
  assert.equal(packageDeclaresRunner({ dependencies: { vitest: '^4.1.5' } }, 'vitest'), true);
  assert.equal(packageDeclaresRunner({ peerDependencies: { vitest: '^4.1.5' } }, 'vitest'), true);
  assert.equal(packageDeclaresRunner({ optionalDependencies: { vitest: '^4.1.5' } }, 'vitest'), true);
  assert.equal(packageDeclaresRunner({ dependencies: { other: '^1.0.0' } }, 'vitest'), false);
  assert.equal(packageDeclaresRunner({}, 'vitest'), false);
});

test('installCommand avoids shell mode while supporting Windows command files', () => {
  const rootDir = path.join('C:\\repo');
  const installPackages = ['vitest@^4.1.5', '@vitest/coverage-v8@^4.1.5'];
  const packageDir = path.join(rootDir, 'lib', 'git-stub');

  assert.deepEqual(installCommand(rootDir, packageDir, installPackages, 'win32'), {
    command: 'cmd.exe',
    args: ['/d', '/s', '/c', 'npm', ...installArgs(rootDir, packageDir, installPackages)],
  });
  assert.deepEqual(installCommand('/repo', '/repo/lib/git-stub', ['vitest@^4.1.5'], 'linux'), {
    command: 'npm',
    args: installArgs('/repo', '/repo/lib/git-stub', ['vitest@^4.1.5']),
  });
});

test('testRunnerInstallPackages installs the runner and scoped coverage helpers once', () => {
  assert.deepEqual(
    testRunnerInstallPackages({
      devDependencies: {
        vitest: '^4.1.5',
        '@vitest/coverage-v8': '^4.1.5',
      },
      peerDependencies: {
        vitest: '^4.1.5',
      },
    }, 'vitest'),
    ['vitest@^4.1.5', '@vitest/coverage-v8@^4.1.5'],
  );
});

test('prepareWorkspaceTests runs npm install when the declared runner is missing', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'prepare-workspace-tests-'));
  await writePackage(rootDir, '.', { workspaces: ['lib/*'] });
  const packageDir = await writePackage(rootDir, 'lib/git-stub', {
    name: '@agent-harness/git-stub',
    devDependencies: { vitest: '^4.1.5' },
  });
  const { calls, spawnImpl } = createSpawnStub({
    onSpawn: async () => {
      await writePackage(rootDir, 'node_modules/vitest', { name: 'vitest' });
    },
  });
  const logs = [];

  const result = await prepareWorkspaceTests(rootDir, '@agent-harness/git-stub', 'vitest', {
    log: (message) => logs.push(message),
    commandAndArgs: { command: 'npm', args: installArgs(rootDir, packageDir, ['vitest@^4.1.5']) },
    spawnImpl,
    stdio: 'pipe',
  });

  assert.deepEqual(result, { installed: true, packageDir });
  assert.deepEqual(logs, [`vitest is missing for @agent-harness/git-stub; running npm install from ${rootDir}`]);
  assert.deepEqual(calls, [[
    'npm',
    installArgs(rootDir, packageDir, ['vitest@^4.1.5']),
    { cwd: rootDir, env: process.env, stdio: 'pipe' },
  ]]);
});

test('prepareWorkspaceTests skips npm install when the runner is already available', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'prepare-workspace-tests-'));
  await writePackage(rootDir, '.', { workspaces: ['lib/*'] });
  const packageDir = await writePackage(rootDir, 'lib/git-stub', {
    name: '@agent-harness/git-stub',
    devDependencies: { vitest: '^4.1.5' },
  });
  await writePackage(rootDir, 'node_modules/vitest', { name: 'vitest' });
  const { calls, spawnImpl } = createSpawnStub();
  const logs = [];

  const result = await prepareWorkspaceTests(rootDir, '@agent-harness/git-stub', 'vitest', {
    log: (message) => logs.push(message),
    spawnImpl,
  });

  assert.deepEqual(result, { installed: false, packageDir });
  assert.deepEqual(logs, ['vitest already available for @agent-harness/git-stub']);
  assert.deepEqual(calls, []);
});

test('prepareWorkspaceTests rejects undeclared runners and missing installs', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'prepare-workspace-tests-'));
  await writePackage(rootDir, '.', { workspaces: ['lib/*'] });
  await writePackage(rootDir, 'lib/git-stub', { name: '@agent-harness/git-stub' });

  await assert.rejects(
    () => prepareWorkspaceTests(rootDir, '@agent-harness/git-stub', 'vitest'),
    /does not declare vitest/,
  );
});

test('prepareWorkspaceTests rejects when install does not make the runner available', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'prepare-workspace-tests-'));
  await writePackage(rootDir, '.', { workspaces: ['lib/*'] });
  await writePackage(rootDir, 'lib/git-stub', {
    name: '@agent-harness/git-stub',
    devDependencies: { vitest: '^4.1.5' },
  });
  const { spawnImpl } = createSpawnStub();

  await assert.rejects(
    () => prepareWorkspaceTests(rootDir, '@agent-harness/git-stub', 'vitest', { spawnImpl }),
    /vitest is still unavailable/,
  );
});

test('runInstall rejects failed npm exits and signals', async () => {
  await runInstall(process.cwd(), path.join(process.cwd(), 'lib/git-stub'), ['vitest@^4.1.5'], {
    commandAndArgs: { command: process.execPath, args: ['-e', 'process.exit(0)'] },
    stdio: 'pipe',
  });

  const successCalls = [];
  await runInstall(process.cwd(), path.join(process.cwd(), 'lib/git-stub'), ['vitest@^4.1.5'], {
    spawnImpl: (...args) => {
      successCalls.push(args);
      const child = new EventEmitter();
      queueMicrotask(() => child.emit('exit', 0, null));
      return child;
    },
  });

  assert.deepEqual(successCalls, [[
    process.platform === 'win32' ? 'cmd.exe' : 'npm',
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm', ...installArgs(process.cwd(), path.join(process.cwd(), 'lib/git-stub'), ['vitest@^4.1.5'])]
      : installArgs(process.cwd(), path.join(process.cwd(), 'lib/git-stub'), ['vitest@^4.1.5']),
    { cwd: process.cwd(), env: process.env, stdio: 'inherit' },
  ]]);

  const customOptionsCalls = [];
  await runInstall(process.cwd(), path.join(process.cwd(), 'lib/git-stub'), ['vitest@^4.1.5'], {
    env: { CUSTOM_ENV: '1' },
    spawnImpl: (...args) => {
      customOptionsCalls.push(args);
      const child = new EventEmitter();
      queueMicrotask(() => child.emit('exit', 0, null));
      return child;
    },
    stdio: 'pipe',
  });

  assert.equal(customOptionsCalls[0][2].env.CUSTOM_ENV, '1');
  assert.equal(customOptionsCalls[0][2].stdio, 'pipe');

  let killed = false;
  await assert.rejects(
    () => runInstall(process.cwd(), path.join(process.cwd(), 'lib/git-stub'), ['vitest@^4.1.5'], {
      spawnImpl: () => {
        const child = new EventEmitter();
        child.kill = () => {
          killed = true;
        };
        return child;
      },
      timeoutMs: 1,
    }),
    /timed out after 1ms/,
  );
  assert.equal(killed, true);

  await assert.rejects(
    () => runInstall(process.cwd(), path.join(process.cwd(), 'lib/git-stub'), ['vitest@^4.1.5'], {
      commandAndArgs: { command: 'npm', args: installArgs(process.cwd(), path.join(process.cwd(), 'lib/git-stub'), ['vitest@^4.1.5']) },
      spawnImpl: () => {
        const child = new EventEmitter();
        queueMicrotask(() => child.emit('exit', 7, null));
        return child;
      },
    }),
    /exited with code 7/,
  );

  await assert.rejects(
    () => runInstall(process.cwd(), path.join(process.cwd(), 'lib/git-stub'), ['vitest@^4.1.5'], {
      commandAndArgs: { command: 'npm', args: installArgs(process.cwd(), path.join(process.cwd(), 'lib/git-stub'), ['vitest@^4.1.5']) },
      spawnImpl: () => {
        const child = new EventEmitter();
        queueMicrotask(() => child.emit('exit', null, 'SIGTERM'));
        return child;
      },
    }),
    /exited with signal SIGTERM/,
  );

  await assert.rejects(
    () => runInstall(process.cwd(), path.join(process.cwd(), 'lib/git-stub'), ['vitest@^4.1.5'], {
      commandAndArgs: { command: 'npm', args: installArgs(process.cwd(), path.join(process.cwd(), 'lib/git-stub'), ['vitest@^4.1.5']) },
      spawnImpl: () => {
        const child = new EventEmitter();
        queueMicrotask(() => child.emit('exit', null, null));
        return child;
      },
    }),
    /exited with code 1/,
  );

  await assert.rejects(
    () => runInstall(process.cwd(), path.join(process.cwd(), 'lib/git-stub'), ['vitest@^4.1.5'], {
      commandAndArgs: { command: 'npm', args: installArgs(process.cwd(), path.join(process.cwd(), 'lib/git-stub'), ['vitest@^4.1.5']) },
      spawnImpl: () => {
        const child = new EventEmitter();
        queueMicrotask(() => child.emit('error', new Error('spawn failed')));
        return child;
      },
    }),
    /spawn failed/,
  );
});

test('main prepares the requested workspace from argv', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'prepare-workspace-tests-'));
  await writePackage(rootDir, '.', { workspaces: ['lib/*'] });
  await writePackage(rootDir, 'lib/git-stub', {
    name: '@agent-harness/git-stub',
    devDependencies: { customRunner: '^1.0.0' },
  });
  const { calls, spawnImpl } = createSpawnStub({
    onSpawn: async () => {
      await writePackage(rootDir, 'node_modules/customRunner', { name: 'customRunner' });
    },
  });

  await main(['--workspace', '@agent-harness/git-stub', '--runner', 'customRunner'], {
    rootDir,
    commandAndArgs: { command: 'npm', args: installArgs(rootDir, path.join(rootDir, 'lib/git-stub'), ['customRunner@^1.0.0']) },
    spawnImpl,
  });

  assert.equal(calls.length, 1);
});

test('main defaults to the current working directory', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'prepare-workspace-tests-'));
  await writePackage(rootDir, '.', { workspaces: ['lib/*'] });
  await writePackage(rootDir, 'lib/git-stub', {
    name: '@agent-harness/git-stub',
    devDependencies: { customRunner: '^1.0.0' },
  });
  const originalCwd = process.cwd();
  const { calls, spawnImpl } = createSpawnStub({
    onSpawn: async () => {
      await writePackage(rootDir, 'node_modules/customRunner', { name: 'customRunner' });
    },
  });

  process.chdir(rootDir);
  try {
    await main(['--workspace', '@agent-harness/git-stub', '--runner', 'customRunner'], {
      commandAndArgs: { command: 'npm', args: installArgs(rootDir, path.join(rootDir, 'lib/git-stub'), ['customRunner@^1.0.0']) },
      spawnImpl,
    });
  } finally {
    process.chdir(originalCwd);
  }

  assert.equal(calls[0][2].cwd, rootDir);
});
