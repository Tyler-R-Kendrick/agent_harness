import assert from 'node:assert/strict';

import {
  findTrackedGeneratedArtifacts,
  formatTrackedGeneratedArtifactsError,
} from './check-generated-files-clean.mjs';

const trackedArtifacts = findTrackedGeneratedArtifacts([
  'src/index.ts',
  'agent-harness-0.1.0.tgz',
  'lib/webmcp/agent-harness-webmcp-0.1.0.tgz',
]);

assert.deepEqual(trackedArtifacts, [
  { path: 'agent-harness-0.1.0.tgz', rule: '*.tgz' },
  { path: 'lib/webmcp/agent-harness-webmcp-0.1.0.tgz', rule: '*.tgz' },
]);

assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /agent-harness-0\.1\.0\.tgz/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /lib\/webmcp\/agent-harness-webmcp-0\.1\.0\.tgz/);

console.log('generated file hygiene regression checks passed');
