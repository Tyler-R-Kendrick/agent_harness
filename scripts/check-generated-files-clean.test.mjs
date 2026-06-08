import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  buildGitLsFilesInvocation,
  checkGeneratedFilesClean,
  filterExistingTrackedFiles,
  findTrackedGeneratedArtifacts,
  formatTrackedGeneratedArtifactsError,
  readTrackedFiles,
  readTrackedFilesFromGitIndex,
  readTrackedFilesFromLineInput,
  runGeneratedFilesCleanCli,
} from './check-generated-files-clean.mjs';

function createGitIndex(entries, { version = 2 } = {}) {
  const header = createGitIndexHeader(version, entries.length);
  let previousV4Path = '';
  const entryBuffers = entries.map((entry) => {
    const entryConfig = typeof entry === 'string' ? { path: entry } : entry;
    const pathBuffer = Buffer.from(entryConfig.path, 'utf8');
    const metadata = Buffer.alloc(62);
    const flags = (entryConfig.extended ? 0x4000 : 0) | Math.min(pathBuffer.length, 0xfff);
    metadata.writeUInt16BE(flags, 60);
    const extendedFlags = entryConfig.extended ? Buffer.alloc(2) : Buffer.alloc(0);

    if (version === 4) {
      const prefixLength = sharedPrefixLength(previousV4Path, entryConfig.path);
      const removeCount = previousV4Path.length - prefixLength;
      const suffix = entryConfig.path.slice(prefixLength);
      previousV4Path = entryConfig.path;
      return Buffer.concat([
        metadata,
        extendedFlags,
        encodeGitIndexV4RemoveCount(removeCount),
        Buffer.from(suffix, 'utf8'),
        Buffer.from([0]),
      ]);
    }

    const unpadded = Buffer.concat([metadata, extendedFlags, pathBuffer, Buffer.from([0])]);
    const padding = Buffer.alloc((8 - (unpadded.length % 8)) % 8);
    return Buffer.concat([unpadded, padding]);
  });

  return Buffer.concat([header, ...entryBuffers]);
}

function createGitIndexHeader(version, entryCount) {
  const header = Buffer.alloc(12);
  header.write('DIRC', 0, 'ascii');
  header.writeUInt32BE(version, 4);
  header.writeUInt32BE(entryCount, 8);
  return header;
}

function sharedPrefixLength(left, right) {
  let index = 0;
  while (index < left.length && index < right.length && left[index] === right[index]) {
    index += 1;
  }
  return index;
}

function encodeGitIndexV4RemoveCount(value) {
  const bytes = [value & 0x7f];
  let remaining = value >> 7;
  while (remaining > 0) {
    remaining -= 1;
    bytes.unshift(0x80 | (remaining & 0x7f));
    remaining >>= 7;
  }
  return Buffer.from(bytes);
}

async function writeGitDirIndex(indexBuffer) {
  const fixture = await mkdtemp(path.join(tmpdir(), 'generated-file-git-index-'));
  await mkdir(path.join(fixture, '.git'), { recursive: true });
  await writeFile(path.join(fixture, '.git', 'index'), indexBuffer);
  return fixture;
}

async function writeGitFileIndex(indexBuffer) {
  const fixture = await mkdtemp(path.join(tmpdir(), 'generated-file-git-file-'));
  const gitDir = path.join(fixture, 'actual-git-dir');
  await mkdir(gitDir, { recursive: true });
  await writeFile(path.join(gitDir, 'index'), indexBuffer);
  await writeFile(path.join(fixture, '.git'), `gitdir: ${gitDir}`);
  return fixture;
}

const requiredLocalArtifactIgnorePatterns = [
  '.vercel/',
  '.next/',
  '.vite/',
  '.vitest/',
  '.turbo/',
  '.parcel-cache/',
  '.cache/',
  '.eslintcache',
  'blob-report/',
  'junit.xml',
  'test-results.xml',
  '.pnpm-store/',
  'node_modules/',
  '*.orig',
  '*.rej',
  '*.swp',
  '*.swo',
  '*.sublime-workspace',
  '.idea/',
  '.playwright-mcp/',
  '.codex-verify-*/',
  '.tmp-*',
];

for (const ignoreFilePath of ['.gitignore', '.dockerignore', '.vercelignore']) {
  const ignoreFile = readFileSync(new URL(`../${ignoreFilePath}`, import.meta.url), 'utf8');
  for (const requiredPattern of requiredLocalArtifactIgnorePatterns) {
    assert.match(ignoreFile, new RegExp(`^${requiredPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
}

const trackedArtifacts = findTrackedGeneratedArtifacts([
  'src/index.ts',
  '.vercel/project.json',
  'agent-browser/.next/server/app.js',
  'agent-browser/.vite/deps/_metadata.json',
  'agent-browser/.vitest/results.json',
  '.turbo/runs/last.json',
  '.parcel-cache/data.mdb',
  '.cache/rollup/index.json',
  '.eslintcache',
  'blob-report/report.zip',
  'junit.xml',
  'agent-browser/test-results.xml',
  '.pnpm-store/v3/files/index.json',
  'node_modules/vite/package.json',
  'lib/webmcp/node_modules/vitest/package.json',
  '.playwright-mcp/session.json',
  '.codex-verify-agent-browser/state.json',
  '.tmp-agent-run/output.txt',
  'agent-daemon/dist/index.js',
  'agent-browser/public/downloads/agent-harness-local-inference-daemon-windows-x64.exe',
  'ext/worker/local-inference-worker/dist/agent-harness-local-inference-daemon-windows-x64.exe',
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
  { path: '.vercel/project.json', rule: '.vercel/' },
  { path: 'agent-browser/.next/server/app.js', rule: '.next/' },
  { path: 'agent-browser/.vite/deps/_metadata.json', rule: '.vite/' },
  { path: 'agent-browser/.vitest/results.json', rule: '.vitest/' },
  { path: '.turbo/runs/last.json', rule: '.turbo/' },
  { path: '.parcel-cache/data.mdb', rule: '.parcel-cache/' },
  { path: '.cache/rollup/index.json', rule: '.cache/' },
  { path: '.eslintcache', rule: '.eslintcache' },
  { path: 'blob-report/report.zip', rule: 'blob-report/' },
  { path: 'junit.xml', rule: 'junit.xml' },
  { path: 'agent-browser/test-results.xml', rule: 'test-results.xml' },
  { path: '.pnpm-store/v3/files/index.json', rule: '.pnpm-store/' },
  { path: 'node_modules/vite/package.json', rule: 'node_modules/' },
  { path: 'lib/webmcp/node_modules/vitest/package.json', rule: 'node_modules/' },
  { path: '.playwright-mcp/session.json', rule: '.playwright-mcp/' },
  { path: '.codex-verify-agent-browser/state.json', rule: '.codex-verify-*/' },
  { path: '.tmp-agent-run/output.txt', rule: '.tmp-*' },
  { path: 'agent-daemon/dist/index.js', rule: 'agent-daemon/dist/' },
  {
    path: 'agent-browser/public/downloads/agent-harness-local-inference-daemon-windows-x64.exe',
    rule: 'agent-browser/public/downloads/agent-harness-local-inference-daemon-windows-x64.exe',
  },
  {
    path: 'ext/worker/local-inference-worker/dist/agent-harness-local-inference-daemon-windows-x64.exe',
    rule: 'ext/worker/local-inference-worker/dist/agent-harness-local-inference-daemon-windows-x64.exe',
  },
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
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.vercel\/project\.json/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /agent-browser\/\.next\/server\/app\.js/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /agent-browser\/\.vite\/deps\/_metadata\.json/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /agent-browser\/\.vitest\/results\.json/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.turbo\/runs\/last\.json/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.parcel-cache\/data\.mdb/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.cache\/rollup\/index\.json/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.eslintcache/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /blob-report\/report\.zip/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /junit\.xml/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /agent-browser\/test-results\.xml/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.pnpm-store\/v3\/files\/index\.json/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /node_modules\/vite\/package\.json/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /lib\/webmcp\/node_modules\/vitest\/package\.json/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.playwright-mcp\/session\.json/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.codex-verify-agent-browser\/state\.json/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /\.tmp-agent-run\/output\.txt/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /agent-daemon\/dist\/index\.js/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /agent-browser\/public\/downloads\/agent-harness-local-inference-daemon-windows-x64\.exe/);
assert.match(formatTrackedGeneratedArtifactsError(trackedArtifacts), /ext\/worker\/local-inference-worker\/dist\/agent-harness-local-inference-daemon-windows-x64\.exe/);
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

assert.deepEqual(readTrackedFilesFromLineInput('src/index.ts\r\n  spaced file.tmp  \n\n'), [
  'src/index.ts',
  '  spaced file.tmp  ',
]);

assert.deepEqual(buildGitLsFilesInvocation('/repo', 'linux'), {
  command: 'git',
  args: ['ls-files', '-z'],
});
assert.deepEqual(buildGitLsFilesInvocation('/repo', 'win32'), {
  command: 'powershell',
  args: [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    path.join('/repo', 'scripts', 'codex-git.ps1'),
    'ls-files',
    '-z',
  ],
});

const gitIndexFixture = await writeGitDirIndex(createGitIndex([
  'src/index.ts',
  { path: 'coverage/lcov.info', extended: true },
]));
assert.deepEqual(readTrackedFilesFromGitIndex(gitIndexFixture), [
  'src/index.ts',
  'coverage/lcov.info',
]);

const gitFileFixture = await writeGitFileIndex(createGitIndex(['src/from-git-file.ts'], { version: 3 }));
assert.deepEqual(readTrackedFilesFromGitIndex(gitFileFixture), ['src/from-git-file.ts']);

const longV4Path = `${'a'.repeat(130)}/first.ts`;
const gitIndexV4Fixture = await writeGitDirIndex(createGitIndex([
  longV4Path,
  { path: 'z.ts', extended: true },
  'zebra.ts',
], { version: 4 }));
assert.deepEqual(readTrackedFilesFromGitIndex(gitIndexV4Fixture), [
  longV4Path,
  'z.ts',
  'zebra.ts',
]);

const missingGitFixture = await mkdtemp(path.join(tmpdir(), 'generated-file-no-git-'));
assert.throws(() => readTrackedFilesFromGitIndex(missingGitFixture), /No \.git path found/);

const unsupportedGitFixture = await mkdtemp(path.join(tmpdir(), 'generated-file-unsupported-git-'));
await writeFile(path.join(unsupportedGitFixture, '.git'), 'not a gitdir file');
assert.throws(() => readTrackedFilesFromGitIndex(unsupportedGitFixture), /Unsupported \.git file format/);

const badSignatureFixture = await writeGitDirIndex(Buffer.from('NOPE'));
assert.throws(
  () => readTrackedFilesFromGitIndex(badSignatureFixture),
  /unexpected signature/,
);

const unsupportedVersionIndex = Buffer.alloc(12);
unsupportedVersionIndex.write('DIRC', 0, 'ascii');
unsupportedVersionIndex.writeUInt32BE(5, 4);
const unsupportedVersionFixture = await writeGitDirIndex(unsupportedVersionIndex);
assert.throws(
  () => readTrackedFilesFromGitIndex(unsupportedVersionFixture),
  /Unsupported git index version 5/,
);

const invalidV4PrefixIndex = Buffer.concat([
  createGitIndexHeader(4, 1),
  Buffer.alloc(62),
  Buffer.from([1]),
  Buffer.from('src/index.ts'),
  Buffer.from([0]),
]);
const invalidV4PrefixFixture = await writeGitDirIndex(invalidV4PrefixIndex);
assert.throws(
  () => readTrackedFilesFromGitIndex(invalidV4PrefixFixture),
  /removes more path bytes/,
);

const missingV4PrefixIndex = Buffer.concat([
  createGitIndexHeader(4, 1),
  Buffer.alloc(62),
]);
const missingV4PrefixFixture = await writeGitDirIndex(missingV4PrefixIndex);
assert.throws(
  () => readTrackedFilesFromGitIndex(missingV4PrefixFixture),
  /missing a path prefix length/,
);

const truncatedEntryIndex = Buffer.alloc(12);
truncatedEntryIndex.write('DIRC', 0, 'ascii');
truncatedEntryIndex.writeUInt32BE(2, 4);
truncatedEntryIndex.writeUInt32BE(1, 8);
const truncatedEntryFixture = await writeGitDirIndex(truncatedEntryIndex);
assert.throws(
  () => readTrackedFilesFromGitIndex(truncatedEntryFixture),
  /ended before all entries/,
);

const unterminatedPathIndex = Buffer.concat([truncatedEntryIndex, Buffer.alloc(62), Buffer.from('src/index.ts')]);
const unterminatedPathFixture = await writeGitDirIndex(unterminatedPathIndex);
assert.throws(
  () => readTrackedFilesFromGitIndex(unterminatedPathFixture),
  /missing a path terminator/,
);

assert.deepEqual(readTrackedFiles('/repo', () => ({
  status: 0,
  stdout: Buffer.from('src/index.ts\0README.md\0'),
  stderr: Buffer.alloc(0),
})), ['src/index.ts', 'README.md']);

const eperm = new Error('spawn blocked');
eperm.code = 'EPERM';
assert.deepEqual(readTrackedFiles(gitIndexFixture, () => ({ error: eperm })), [
  'src/index.ts',
  'coverage/lcov.info',
]);

const enoent = new Error('missing command');
enoent.code = 'ENOENT';
assert.throws(() => readTrackedFiles('/repo', () => ({ error: enoent })), /missing command/);
assert.throws(() => readTrackedFiles('/repo', () => ({
  status: 2,
  stdout: Buffer.alloc(0),
  stderr: Buffer.from('fatal: not a git repository\n'),
})), /fatal: not a git repository/);
assert.throws(() => readTrackedFiles('/repo', () => ({
  status: 2,
  stdout: Buffer.alloc(0),
  stderr: Buffer.alloc(0),
})), /git ls-files failed with exit code 2/);

const filterFixture = await mkdtemp(path.join(tmpdir(), 'generated-file-filter-'));
await writeFile(path.join(filterFixture, 'existing.tmp'), '');
await mkdir(path.join(filterFixture, 'nested'), { recursive: true });
await writeFile(path.join(filterFixture, 'nested', 'existing.log'), '');
assert.deepEqual(filterExistingTrackedFiles([
  'existing.tmp',
  'missing.tmp',
  '.\\nested\\existing.log',
], filterFixture), [
  'existing.tmp',
  '.\\nested\\existing.log',
]);

assert.deepEqual(checkGeneratedFilesClean(process.cwd()), []);

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

const liveStdoutWrites = [];
const liveStderrWrites = [];
assert.equal(runGeneratedFilesCleanCli({
  stdout: { write: (value) => liveStdoutWrites.push(value) },
  stderr: { write: (value) => liveStderrWrites.push(value) },
}), 0);
assert.deepEqual(liveStdoutWrites, ['No tracked generated artifacts found.\n']);
assert.deepEqual(liveStderrWrites, []);

console.log('generated file hygiene regression checks passed');
