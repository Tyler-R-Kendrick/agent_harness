import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  findTrackedGeneratedArtifacts,
  formatTrackedGeneratedArtifactsError,
} from './check-generated-files-clean.mjs';

const nodeDiagnosticArtifactPatterns = [
  '*.cpuprofile',
  '*.heapprofile',
  '*.heapsnapshot',
];

for (const ignoreFilePath of ['.gitignore', '.dockerignore', '.vercelignore']) {
  const ignoreFile = readFileSync(new URL(`../${ignoreFilePath}`, import.meta.url), 'utf8');
  for (const pattern of nodeDiagnosticArtifactPatterns) {
    assert.match(ignoreFile, new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
}

const trackedArtifacts = findTrackedGeneratedArtifacts([
  'agent-browser/profile.cpuprofile',
  'scripts/startup.heapprofile',
  'agent-daemon/heap.heapsnapshot',
]);

assert.deepEqual(trackedArtifacts, [
  { path: 'agent-browser/profile.cpuprofile', rule: '*.cpuprofile' },
  { path: 'scripts/startup.heapprofile', rule: '*.heapprofile' },
  { path: 'agent-daemon/heap.heapsnapshot', rule: '*.heapsnapshot' },
]);

const artifactError = formatTrackedGeneratedArtifactsError(trackedArtifacts);
assert.match(artifactError, /agent-browser\/profile\.cpuprofile/);
assert.match(artifactError, /scripts\/startup\.heapprofile/);
assert.match(artifactError, /agent-daemon\/heap\.heapsnapshot/);

console.log('node diagnostic artifact hygiene checks passed');
