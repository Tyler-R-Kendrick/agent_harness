import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  findTrackedGeneratedArtifacts,
  formatTrackedGeneratedArtifactsError,
} from './check-generated-files-clean.mjs';

const nodeDiagnosticArtifactPatterns = [
  'report.*.json',
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
  'report.20260609.123456.789.0.001.json',
  'agent-browser/profile.cpuprofile',
  'scripts/startup.heapprofile',
  'agent-daemon/heap.heapsnapshot',
  'docs/release-report.json',
]);

assert.deepEqual(trackedArtifacts, [
  { path: 'report.20260609.123456.789.0.001.json', rule: 'report.*.json' },
  { path: 'agent-browser/profile.cpuprofile', rule: '*.cpuprofile' },
  { path: 'scripts/startup.heapprofile', rule: '*.heapprofile' },
  { path: 'agent-daemon/heap.heapsnapshot', rule: '*.heapsnapshot' },
]);

const artifactError = formatTrackedGeneratedArtifactsError(trackedArtifacts);
assert.match(artifactError, /report\.20260609\.123456\.789\.0\.001\.json/);
assert.match(artifactError, /agent-browser\/profile\.cpuprofile/);
assert.match(artifactError, /scripts\/startup\.heapprofile/);
assert.match(artifactError, /agent-daemon\/heap\.heapsnapshot/);

console.log('node diagnostic artifact hygiene checks passed');
