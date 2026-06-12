import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  findTrackedGeneratedArtifacts,
  formatTrackedGeneratedArtifactsError,
} from './check-generated-files-clean.mjs';

const crashDumpArtifactPatterns = [
  'core',
  '!core/',
  '!**/core/',
  '!**/core/**',
  'core.[0-9]*',
  '*.dmp',
  '*.mdmp',
];

for (const ignoreFilePath of ['.gitignore', '.dockerignore', '.vercelignore']) {
  const ignoreFile = readFileSync(new URL(`../${ignoreFilePath}`, import.meta.url), 'utf8');
  for (const pattern of crashDumpArtifactPatterns) {
    assert.match(ignoreFile, new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
}

const trackedArtifacts = findTrackedGeneratedArtifacts([
  'core',
  'agent-browser/core.12345',
  'agent-daemon/crash.dmp',
  'ext/worker/local-inference-worker/worker.mdmp',
  'lib/worker/src/__tests__/core.test.ts',
  'skills/ui-ux-pro-max/scripts/core.py',
  'lib/workgraph/src/core/types.ts',
]);

assert.deepEqual(trackedArtifacts, [
  { path: 'core', rule: 'core' },
  { path: 'agent-browser/core.12345', rule: 'core.[0-9]*' },
  { path: 'agent-daemon/crash.dmp', rule: '*.dmp' },
  { path: 'ext/worker/local-inference-worker/worker.mdmp', rule: '*.mdmp' },
]);

const artifactError = formatTrackedGeneratedArtifactsError(trackedArtifacts);
assert.match(artifactError, /^Generated or local-only artifacts are tracked by git\./);
assert.match(artifactError, /core \(core\)/);
assert.match(artifactError, /agent-browser\/core\.12345/);
assert.match(artifactError, /agent-daemon\/crash\.dmp/);
assert.match(artifactError, /ext\/worker\/local-inference-worker\/worker\.mdmp/);
assert.doesNotMatch(artifactError, /core\.test\.ts/);
assert.doesNotMatch(artifactError, /core\.py/);

console.log('crash dump artifact hygiene checks passed');
