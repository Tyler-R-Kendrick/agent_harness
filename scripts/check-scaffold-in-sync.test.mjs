import assert from 'node:assert/strict';

import {
  checkScaffoldInSync,
  findUndocumentedDirectories,
  formatUndocumentedError,
  listTopLevelDirectories,
  parseDocumentedDirectories,
  runScaffoldInSyncCli,
} from './check-scaffold-in-sync.mjs';

// parseDocumentedDirectories extracts first-segment tokens from backtick paths.
const documented = parseDocumentedDirectories(
  'See `agent-browser/`, `lib/workers/`, and the `docs/adr/` folder. Ignore `plain`.',
);
assert.equal(documented.has('agent-browser'), true);
assert.equal(documented.has('lib'), true);
assert.equal(documented.has('docs'), true);
assert.equal(documented.has('plain'), false);

// findUndocumentedDirectories returns only the missing directories.
assert.deepEqual(
  findUndocumentedDirectories(['agent-browser', 'mystery'], new Set(['agent-browser'])),
  ['mystery'],
);
assert.deepEqual(
  findUndocumentedDirectories(['agent-browser'], new Set(['agent-browser'])),
  [],
);

// formatUndocumentedError names every missing directory.
const errorText = formatUndocumentedError(['mystery', 'ghost']);
assert.match(errorText, /mystery\//);
assert.match(errorText, /ghost\//);
assert.match(errorText, /out of sync/);

// CLI returns 0 and reports success when every directory is documented.
const okStdout = [];
const okStderr = [];
assert.equal(
  runScaffoldInSyncCli({
    directories: ['agent-browser'],
    scaffoldText: '`agent-browser/`',
    stdout: { write: (value) => okStdout.push(value) },
    stderr: { write: (value) => okStderr.push(value) },
  }),
  0,
);
assert.deepEqual(okStdout, ['SCAFFOLD.md documents every top-level directory.\n']);
assert.deepEqual(okStderr, []);

// CLI returns 1 and writes the error when a directory is undocumented.
const failStdout = [];
const failStderr = [];
assert.equal(
  runScaffoldInSyncCli({
    directories: ['agent-browser', 'mystery'],
    scaffoldText: '`agent-browser/`',
    stdout: { write: (value) => failStdout.push(value) },
    stderr: { write: (value) => failStderr.push(value) },
  }),
  1,
);
assert.deepEqual(failStdout, []);
assert.match(failStderr.join(''), /mystery\//);

// listTopLevelDirectories excludes dotdirs and dependency/generated trees.
const liveDirectories = listTopLevelDirectories();
assert.equal(liveDirectories.includes('node_modules'), false);
assert.equal(liveDirectories.some((name) => name.startsWith('.')), false);
assert.equal(liveDirectories.includes('agent-browser'), true);

// The live repository must already be in sync (SCAFFOLD.md documents every dir).
assert.deepEqual(checkScaffoldInSync(), []);

// Live CLI run against the real repository succeeds.
const liveStdout = [];
const liveStderr = [];
assert.equal(
  runScaffoldInSyncCli({
    stdout: { write: (value) => liveStdout.push(value) },
    stderr: { write: (value) => liveStderr.push(value) },
  }),
  0,
);
assert.deepEqual(liveStderr, []);

console.log('scaffold in-sync regression checks passed');
