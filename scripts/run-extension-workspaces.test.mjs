import assert from 'node:assert/strict';

import {
  buildWorkspaceSpawnOptions,
  normalizeRequestedScripts,
  resolveNpmInvocation,
} from './run-extension-workspaces.mjs';

assert.throws(
  () => normalizeRequestedScripts([]),
  /At least one extension script must be provided/,
);
assert.deepEqual(normalizeRequestedScripts(['lint', 'test:coverage']), ['lint', 'test:coverage']);
assert.deepEqual(normalizeRequestedScripts([' lint ', '\ttest:coverage\n']), ['lint', 'test:coverage']);
assert.throws(
  () => normalizeRequestedScripts(['lint', '   ']),
  /Extension script names must not be blank/,
);
const spawnOptions = buildWorkspaceSpawnOptions('/repo');
assert.equal(spawnOptions.cwd, '/repo');
assert.equal(spawnOptions.stdio, 'inherit');
assert.equal(Object.hasOwn(spawnOptions, 'shell'), false);
assert.deepEqual(
  resolveNpmInvocation({
    npmExecPath: '/tooling/npm-cli.js',
    nodeExecPath: '/node',
  }),
  {
    command: '/node',
    argsPrefix: ['/tooling/npm-cli.js'],
  },
);
assert.deepEqual(
  resolveNpmInvocation({
    platform: 'win32',
    npmExecPath: '',
    comSpec: 'C:/Windows/System32/cmd.exe',
  }),
  {
    command: 'C:/Windows/System32/cmd.exe',
    argsPrefix: ['/d', '/s', '/c', 'npm.cmd'],
  },
);

console.log('extension workspace runner regression checks passed');
