import assert from 'node:assert/strict';

import {
  findTrackedGeneratedArtifacts,
  formatTrackedGeneratedArtifactsError,
} from './check-generated-files-clean.mjs';

const trackedArtifacts = findTrackedGeneratedArtifacts([
  'src/index.ts',
  'agent-harness-0.1.0.tgz',
  'lib/webmcp/agent-harness-webmcp-0.1.0.tgz',
  'skills/webapp-testing/scripts/__pycache__/with_server.cpython-312.pyc',
  '.pytest_cache/v/cache/nodeids',
  '.venv/pyvenv.cfg',
]);

assert.deepEqual(trackedArtifacts, [
  { path: 'agent-harness-0.1.0.tgz', rule: '*.tgz' },
  { path: 'lib/webmcp/agent-harness-webmcp-0.1.0.tgz', rule: '*.tgz' },
  {
    path: 'skills/webapp-testing/scripts/__pycache__/with_server.cpython-312.pyc',
    rule: '__pycache__/',
  },
  { path: '.pytest_cache/v/cache/nodeids', rule: '.pytest_cache/' },
  { path: '.venv/pyvenv.cfg', rule: '.venv/' },
]);

assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /agent-harness-0\.1\.0\.tgz/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /lib\/webmcp\/agent-harness-webmcp-0\.1\.0\.tgz/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /__pycache__/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.pytest_cache/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.venv/);

console.log('generated file hygiene regression checks passed');
