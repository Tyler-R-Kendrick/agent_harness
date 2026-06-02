import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  findTrackedGeneratedArtifacts,
  formatTrackedGeneratedArtifactsError,
  runGeneratedFilesCleanCli,
} from './check-generated-files-clean.mjs';

const requiredLocalArtifactIgnorePatterns = [
  '*.orig',
  '*.rej',
  '*.swp',
  '*.swo',
  '*.sublime-workspace',
  '.idea/',
];

for (const ignoreFilePath of ['.gitignore', '.dockerignore', '.vercelignore']) {
  const ignoreFile = readFileSync(new URL(`../${ignoreFilePath}`, import.meta.url), 'utf8');
  for (const requiredPattern of requiredLocalArtifactIgnorePatterns) {
    assert.match(ignoreFile, new RegExp(`^${requiredPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
}

const trackedArtifacts = findTrackedGeneratedArtifacts([
  'src/index.ts',
  'agent-harness-0.1.0.tgz',
  'lib/webmcp/agent-harness-webmcp-0.1.0.tgz',
  'README.md.orig',
  'patches/local-change.rej',
  '.App.tsx.swp',
  'notes.swo',
  'agent-harness.sublime-workspace',
  '.idea/workspace.xml',
  'skills/webapp-testing/scripts/__pycache__/with_server.cpython-312.pyc',
  '.pytest_cache/v/cache/nodeids',
  '.venv/pyvenv.cfg',
]);

assert.deepEqual(trackedArtifacts, [
  { path: 'agent-harness-0.1.0.tgz', rule: '*.tgz' },
  { path: 'lib/webmcp/agent-harness-webmcp-0.1.0.tgz', rule: '*.tgz' },
  { path: 'README.md.orig', rule: '*.orig' },
  { path: 'patches/local-change.rej', rule: '*.rej' },
  { path: '.App.tsx.swp', rule: '*.swp' },
  { path: 'notes.swo', rule: '*.swo' },
  { path: 'agent-harness.sublime-workspace', rule: '*.sublime-workspace' },
  { path: '.idea/workspace.xml', rule: '.idea/' },
  {
    path: 'skills/webapp-testing/scripts/__pycache__/with_server.cpython-312.pyc',
    rule: '__pycache__/',
  },
  { path: '.pytest_cache/v/cache/nodeids', rule: '.pytest_cache/' },
  { path: '.venv/pyvenv.cfg', rule: '.venv/' },
]);

assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /agent-harness-0\.1\.0\.tgz/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /lib\/webmcp\/agent-harness-webmcp-0\.1\.0\.tgz/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /README\.md\.orig/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /patches\/local-change\.rej/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.App\.tsx\.swp/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /notes\.swo/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /agent-harness\.sublime-workspace/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.idea\/workspace\.xml/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /__pycache__/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.pytest_cache/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.venv/);

const cleanStdoutWrites = [];
const cleanStderrWrites = [];
assert.equal(runGeneratedFilesCleanCli({
  trackedFiles: ['src/index.ts'],
  cwd: process.cwd(),
  stdout: { write: (value) => cleanStdoutWrites.push(value) },
  stderr: { write: (value) => cleanStderrWrites.push(value) },
}), 0);
assert.deepEqual(cleanStdoutWrites, ['No tracked generated artifacts found.\n']);
assert.deepEqual(cleanStderrWrites, []);

const dirtyStdoutWrites = [];
const dirtyStderrWrites = [];
const dirtyFixture = await mkdtemp(path.join(tmpdir(), 'generated-file-hygiene-'));
await writeFile(path.join(dirtyFixture, 'agent-harness-0.1.0.tgz'), '');
assert.equal(runGeneratedFilesCleanCli({
  trackedFiles: ['agent-harness-0.1.0.tgz'],
  cwd: dirtyFixture,
  stdout: { write: (value) => dirtyStdoutWrites.push(value) },
  stderr: { write: (value) => dirtyStderrWrites.push(value) },
}), 1);
assert.deepEqual(dirtyStdoutWrites, []);
assert.match(dirtyStderrWrites.join(''), /agent-harness-0\.1\.0\.tgz/);

console.log('generated file hygiene regression checks passed');
