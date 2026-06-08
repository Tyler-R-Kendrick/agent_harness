import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  findTrackedGeneratedArtifacts,
  formatTrackedGeneratedArtifactsError,
} from './check-generated-files-clean.mjs';

const localDaemonArtifactPatterns = [
  'agent-daemon/dist/',
  'agent-browser/public/downloads/agent-harness-local-inference-daemon-windows-x64.exe',
  'ext/worker/local-inference-worker/dist/agent-harness-local-inference-daemon-windows-x64.exe',
];

for (const ignoreFilePath of ['.gitignore', '.dockerignore', '.vercelignore']) {
  const ignoreFile = readFileSync(new URL(`../${ignoreFilePath}`, import.meta.url), 'utf8');
  for (const pattern of localDaemonArtifactPatterns) {
    assert.match(ignoreFile, new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
}

const trackedArtifacts = findTrackedGeneratedArtifacts([
  'agent-daemon/dist/agent-harness-local-inference-daemon-windows-x64.exe',
  'agent-browser/public/downloads/agent-harness-local-inference-daemon-windows-x64.exe',
  'ext/worker/local-inference-worker/dist/agent-harness-local-inference-daemon-windows-x64.exe',
]);

assert.deepEqual(trackedArtifacts, [
  {
    path: 'agent-daemon/dist/agent-harness-local-inference-daemon-windows-x64.exe',
    rule: 'agent-daemon/dist/',
  },
  {
    path: 'agent-browser/public/downloads/agent-harness-local-inference-daemon-windows-x64.exe',
    rule: 'agent-browser/public/downloads/agent-harness-local-inference-daemon-windows-x64.exe',
  },
  {
    path: 'ext/worker/local-inference-worker/dist/agent-harness-local-inference-daemon-windows-x64.exe',
    rule: 'ext/worker/local-inference-worker/dist/agent-harness-local-inference-daemon-windows-x64.exe',
  },
]);

const artifactError = formatTrackedGeneratedArtifactsError(trackedArtifacts);
assert.match(artifactError, /agent-daemon\/dist\/agent-harness-local-inference-daemon-windows-x64\.exe/);
assert.match(artifactError, /agent-browser\/public\/downloads\/agent-harness-local-inference-daemon-windows-x64\.exe/);
assert.match(artifactError, /ext\/worker\/local-inference-worker\/dist\/agent-harness-local-inference-daemon-windows-x64\.exe/);

console.log('local daemon artifact hygiene checks passed');
