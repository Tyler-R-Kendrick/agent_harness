import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  findTrackedGeneratedArtifacts,
  formatTrackedGeneratedArtifactsError,
} from './check-generated-files-clean.mjs';

const browserDebugArtifactPatterns = [
  '*.har',
  'trace.zip',
];

for (const ignoreFilePath of ['.gitignore', '.dockerignore', '.vercelignore']) {
  const ignoreFile = readFileSync(new URL(`../${ignoreFilePath}`, import.meta.url), 'utf8');
  for (const pattern of browserDebugArtifactPatterns) {
    assert.match(ignoreFile, new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
}

const trackedArtifacts = findTrackedGeneratedArtifacts([
  'agent-browser/network.har',
  'agent-browser/tests/trace.zip',
]);

assert.deepEqual(trackedArtifacts, [
  { path: 'agent-browser/network.har', rule: '*.har' },
  { path: 'agent-browser/tests/trace.zip', rule: 'trace.zip' },
]);

const artifactError = formatTrackedGeneratedArtifactsError(trackedArtifacts);
assert.match(artifactError, /agent-browser\/network\.har/);
assert.match(artifactError, /agent-browser\/tests\/trace\.zip/);

console.log('browser debug artifact hygiene checks passed');
