import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';

import {
  errorCauseMessage,
  errorMessage,
  main,
  resolvePackageBin,
  resolvePackageBinPath,
  runPackageBin,
  selectPackageBinPath,
} from './run-package-bin.mjs';

async function createPackageFixture(rootDir, packageName, packageJson) {
  const packagePath = path.join(rootDir, 'node_modules', ...packageName.split('/'));
  await mkdir(packagePath, { recursive: true });
  await writeFile(path.join(packagePath, 'package.json'), JSON.stringify(packageJson, null, 2));
  return packagePath;
}

function createSpawnStub() {
  const child = new EventEmitter();
  const calls = [];
  const spawnImpl = (...args) => {
    calls.push(args);
    return child;
  };
  return { child, calls, spawnImpl };
}

test('selectPackageBinPath prefers the package-specific entry', () => {
  assert.equal(
    selectPackageBinPath('@scope/tool', {
      bin: {
        other: './other.js',
        tool: './tool.js',
        '@scope/tool': './scoped.js',
      },
    }),
    './scoped.js',
  );
});

test('selectPackageBinPath falls back to the default unscoped bin name', () => {
  assert.equal(
    selectPackageBinPath('@scope/tool', {
      bin: {
        tool: './tool.js',
      },
    }),
    './tool.js',
  );
});

test('selectPackageBinPath falls back to the first string bin entry', () => {
  assert.equal(
    selectPackageBinPath('tool', {
      bin: {
        invalid: 123,
        alternate: './alternate.js',
      },
    }),
    './alternate.js',
  );
});

test('selectPackageBinPath returns undefined when bin metadata is absent', () => {
  assert.equal(selectPackageBinPath('tool', {}), undefined);
});

test('selectPackageBinPath returns undefined when bin metadata is not an object or string', () => {
  assert.equal(selectPackageBinPath('tool', { bin: 7 }), undefined);
});

test('selectPackageBinPath handles empty package names without a default bin alias', () => {
  assert.equal(
    selectPackageBinPath('', {
      bin: {
        fallback: './fallback.js',
      },
    }),
    './fallback.js',
  );
});

test('error helpers normalize error and cause messages', () => {
  assert.equal(errorMessage(new Error('boom')), 'boom');
  assert.equal(errorMessage('plain failure'), 'plain failure');
  assert.equal(errorCauseMessage(new Error('boom')), undefined);
  assert.equal(errorCauseMessage(new Error('boom', { cause: new Error('nested') })), 'nested');
  assert.equal(errorCauseMessage(new Error('boom', { cause: 'nested-string' })), 'nested-string');
  assert.equal(errorCauseMessage('plain failure'), undefined);
});

test('resolvePackageBin resolves an in-package string bin', async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'run-package-bin-'));
  const packagePath = await createPackageFixture(fixtureRoot, 'string-bin-package', { bin: './cli.js' });
  await writeFile(path.join(fixtureRoot, 'package.json'), JSON.stringify({ name: 'fixture-root' }));
  const fixtureRequire = createRequire(path.join(fixtureRoot, 'package.json'));

  assert.equal(
    await resolvePackageBin('string-bin-package', fixtureRequire, fixtureRoot),
    path.join(packagePath, 'cli.js'),
  );
});

test('resolvePackageBin resolves a scoped object bin', async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'run-package-bin-'));
  const packagePath = await createPackageFixture(fixtureRoot, '@scope/object-bin-package', {
    bin: {
      '@scope/object-bin-package': './scoped-cli.js',
      object: './default-cli.js',
    },
  });
  await writeFile(path.join(fixtureRoot, 'package.json'), JSON.stringify({ name: 'fixture-root' }));
  const fixtureRequire = createRequire(path.join(fixtureRoot, 'package.json'));

  assert.equal(
    await resolvePackageBin('@scope/object-bin-package', fixtureRequire, fixtureRoot),
    path.join(packagePath, 'scoped-cli.js'),
  );
});

test('resolvePackageBin rejects packages without a runnable bin', async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'run-package-bin-'));
  await createPackageFixture(fixtureRoot, 'missing-bin-package', {});
  await writeFile(path.join(fixtureRoot, 'package.json'), JSON.stringify({ name: 'fixture-root' }));
  const fixtureRequire = createRequire(path.join(fixtureRoot, 'package.json'));

  await assert.rejects(
    () => resolvePackageBin('missing-bin-package', fixtureRequire, fixtureRoot),
    /does not declare a runnable bin entry/,
  );
});

test('resolvePackageBin rejects missing package names', async () => {
  await assert.rejects(
    () => resolvePackageBin('', undefined, process.cwd()),
    /Usage: node scripts\/run-package-bin\.mjs <package-name> \[args\.\.\.\]/,
  );
});

test('resolvePackageBinPath rejects traversal outside the package directory', () => {
  assert.throws(
    () => resolvePackageBinPath(
      path.join('C:\\repo', 'node_modules', 'unsafe-package', 'package.json'),
      '../outside.js',
      'unsafe-package',
    ),
    /outside its package directory/,
  );
});

test('resolvePackageBinPath rejects whitespace-only bin paths', () => {
  assert.throws(
    () => resolvePackageBinPath(
      path.join('C:\\repo', 'node_modules', 'unsafe-package', 'package.json'),
      '   ',
      'unsafe-package',
    ),
    /does not declare a runnable bin entry/,
  );
});

test('resolvePackageBinPath rejects absolute bin paths', () => {
  assert.throws(
    () => resolvePackageBinPath(
      path.join('C:\\repo', 'node_modules', 'unsafe-package', 'package.json'),
      path.join('C:\\repo', 'outside.js'),
      'unsafe-package',
    ),
    /outside its package directory/,
  );
});

test('resolvePackageBinPath rejects cross-drive absolute bin paths', () => {
  assert.throws(
    () => resolvePackageBinPath(
      'C:\\repo\\node_modules\\unsafe-package\\package.json',
      'D:\\outside.js',
      'unsafe-package',
    ),
    /outside its package directory/,
  );
});

test('runPackageBin spawns the resolved bin from the current package root', async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'run-package-bin-'));
  const packagePath = await createPackageFixture(fixtureRoot, 'runner-package', { bin: './cli.js' });
  await writeFile(path.join(fixtureRoot, 'package.json'), JSON.stringify({ name: 'fixture-root' }));
  const fixtureRequire = createRequire(path.join(fixtureRoot, 'package.json'));
  const { child, calls, spawnImpl } = createSpawnStub();

  const exits = [];
  await runPackageBin('runner-package', ['--flag'], {
    cwd: fixtureRoot,
    env: { TEST_ENV: '1' },
    requireFromPackage: fixtureRequire,
    spawnImpl,
    exit: (code) => exits.push(code),
    stdio: 'pipe',
  });

  assert.deepEqual(calls, [[
    process.execPath,
    [path.join(packagePath, 'cli.js'), '--flag'],
    { cwd: fixtureRoot, env: { TEST_ENV: '1' }, stdio: 'pipe' },
  ]]);

  child.emit('exit', 0, null);
  assert.deepEqual(exits, [0]);
});

test('runPackageBin exits with code 1 when spawn emits an error', async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'run-package-bin-'));
  await createPackageFixture(fixtureRoot, 'runner-package', { bin: './cli.js' });
  await writeFile(path.join(fixtureRoot, 'package.json'), JSON.stringify({ name: 'fixture-root' }));
  const fixtureRequire = createRequire(path.join(fixtureRoot, 'package.json'));
  const { child, spawnImpl } = createSpawnStub();
  const logs = [];
  const exits = [];

  await runPackageBin('runner-package', [], {
    cwd: fixtureRoot,
    requireFromPackage: fixtureRequire,
    spawnImpl,
    logError: (value) => logs.push(value),
    exit: (code) => exits.push(code),
  });

  child.emit('error', new Error('spawn failed'));

  assert.deepEqual(logs, ['Failed to start runner-package', 'spawn failed']);
  assert.deepEqual(exits, [1]);
});

test('runPackageBin stringifies non-Error spawn failures', async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'run-package-bin-'));
  await createPackageFixture(fixtureRoot, 'runner-package', { bin: './cli.js' });
  await writeFile(path.join(fixtureRoot, 'package.json'), JSON.stringify({ name: 'fixture-root' }));
  const fixtureRequire = createRequire(path.join(fixtureRoot, 'package.json'));
  const { child, spawnImpl } = createSpawnStub();
  const logs = [];

  await runPackageBin('runner-package', [], {
    cwd: fixtureRoot,
    requireFromPackage: fixtureRequire,
    spawnImpl,
    logError: (value) => logs.push(value),
    exit: () => {},
  });

  child.emit('error', 'spawn failed');

  assert.deepEqual(logs, ['Failed to start runner-package', 'spawn failed']);
});

test('runPackageBin uses the default console.error and process.exit on spawn errors', async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'run-package-bin-'));
  await createPackageFixture(fixtureRoot, 'runner-package', { bin: './cli.js' });
  await writeFile(path.join(fixtureRoot, 'package.json'), JSON.stringify({ name: 'fixture-root' }));
  const fixtureRequire = createRequire(path.join(fixtureRoot, 'package.json'));
  const { child, spawnImpl } = createSpawnStub();
  const logs = [];
  const exits = [];
  const originalConsoleError = console.error;
  const originalProcessExit = process.exit;

  console.error = (value) => logs.push(value);
  process.exit = (code) => exits.push(code);
  try {
    await runPackageBin('runner-package', [], {
      cwd: fixtureRoot,
      requireFromPackage: fixtureRequire,
      spawnImpl,
    });

    child.emit('error', new Error('spawn failed'));
  } finally {
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  }

  assert.deepEqual(logs, ['Failed to start runner-package', 'spawn failed']);
  assert.deepEqual(exits, [1]);
});

test('runPackageBin forwards exit signals to process.kill', async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'run-package-bin-'));
  await createPackageFixture(fixtureRoot, 'runner-package', { bin: './cli.js' });
  await writeFile(path.join(fixtureRoot, 'package.json'), JSON.stringify({ name: 'fixture-root' }));
  const fixtureRequire = createRequire(path.join(fixtureRoot, 'package.json'));
  const { child, spawnImpl } = createSpawnStub();
  const kills = [];

  await runPackageBin('runner-package', [], {
    cwd: fixtureRoot,
    requireFromPackage: fixtureRequire,
    spawnImpl,
    kill: (...args) => kills.push(args),
  });

  child.emit('exit', null, 'SIGTERM');

  assert.deepEqual(kills, [[process.pid, 'SIGTERM']]);
});

test('runPackageBin uses the default process.kill for exit signals', async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'run-package-bin-'));
  await createPackageFixture(fixtureRoot, 'runner-package', { bin: './cli.js' });
  await writeFile(path.join(fixtureRoot, 'package.json'), JSON.stringify({ name: 'fixture-root' }));
  const fixtureRequire = createRequire(path.join(fixtureRoot, 'package.json'));
  const { child, spawnImpl } = createSpawnStub();
  const kills = [];
  const originalProcessKill = process.kill;

  process.kill = (...args) => kills.push(args);
  try {
    await runPackageBin('runner-package', [], {
      cwd: fixtureRoot,
      requireFromPackage: fixtureRequire,
      spawnImpl,
    });

    child.emit('exit', null, 'SIGTERM');
  } finally {
    process.kill = originalProcessKill;
  }

  assert.deepEqual(kills, [[process.pid, 'SIGTERM']]);
});

test('runPackageBin exits with the child status code', async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'run-package-bin-'));
  await createPackageFixture(fixtureRoot, 'runner-package', { bin: './cli.js' });
  await writeFile(path.join(fixtureRoot, 'package.json'), JSON.stringify({ name: 'fixture-root' }));
  const fixtureRequire = createRequire(path.join(fixtureRoot, 'package.json'));
  const { child, spawnImpl } = createSpawnStub();
  const exits = [];

  await runPackageBin('runner-package', [], {
    cwd: fixtureRoot,
    requireFromPackage: fixtureRequire,
    spawnImpl,
    exit: (code) => exits.push(code),
  });

  child.emit('exit', null, null);
  child.emit('exit', 7, null);

  assert.deepEqual(exits, [1, 7]);
});

test('runPackageBin uses the default process.exit for child exit codes', async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'run-package-bin-'));
  await createPackageFixture(fixtureRoot, 'runner-package', { bin: './cli.js' });
  await writeFile(path.join(fixtureRoot, 'package.json'), JSON.stringify({ name: 'fixture-root' }));
  const fixtureRequire = createRequire(path.join(fixtureRoot, 'package.json'));
  const { child, spawnImpl } = createSpawnStub();
  const exits = [];
  const originalProcessExit = process.exit;

  process.exit = (code) => exits.push(code);
  try {
    await runPackageBin('runner-package', [], {
      cwd: fixtureRoot,
      requireFromPackage: fixtureRequire,
      spawnImpl,
    });

    child.emit('exit', 5, null);
  } finally {
    process.exit = originalProcessExit;
  }

  assert.deepEqual(exits, [5]);
});

test('runPackageBin supports the default spawn implementation', async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'run-package-bin-'));
  await createPackageFixture(fixtureRoot, 'runner-package', { bin: './cli.js' });
  await writeFile(path.join(fixtureRoot, 'package.json'), JSON.stringify({ name: 'fixture-root' }));
  await writeFile(path.join(fixtureRoot, 'node_modules', 'runner-package', 'cli.js'), 'process.exit(0);\n');
  const fixtureRequire = createRequire(path.join(fixtureRoot, 'package.json'));

  const exitCode = await new Promise((resolve) => {
    runPackageBin('runner-package', [], {
      cwd: fixtureRoot,
      requireFromPackage: fixtureRequire,
      exit: resolve,
    });
  });

  assert.equal(exitCode, 0);
});

test('main reports resolution errors and exits with status 1', async () => {
  const logs = [];
  const exits = [];

  await main(['node', 'scripts/run-package-bin.mjs', 'missing-package'], {
    cwd: process.cwd(),
    logError: (value) => logs.push(value),
    exit: (code) => exits.push(code),
  });

  assert.match(logs[0], /Unable to resolve missing-package/);
  assert.equal(typeof logs[1], 'string');
  assert.deepEqual(exits, [1]);
});

test('main reports usage errors without a nested cause', async () => {
  const logs = [];
  const exits = [];

  await main(['node', 'scripts/run-package-bin.mjs'], {
    logError: (value) => logs.push(value),
    exit: (code) => exits.push(code),
  });

  assert.deepEqual(logs, ['Usage: node scripts/run-package-bin.mjs <package-name> [args...]']);
  assert.deepEqual(exits, [1]);
});
