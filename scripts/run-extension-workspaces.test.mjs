import assert from 'node:assert/strict';

import { normalizeRequestedScripts } from './run-extension-workspaces.mjs';

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

console.log('extension workspace runner regression checks passed');
