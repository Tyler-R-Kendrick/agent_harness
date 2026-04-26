import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  findEvalManifestPaths,
  validateEvalManifestContent,
  validateEvalManifestFile,
  validateRepoEvalManifests,
} from './eval-manifest-validator.mjs';

const tempDirs = [];

async function makeTempDir() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eval-manifest-validator-'));
  tempDirs.push(tempDir);
  return tempDir;
}

async function cleanupTempDirs() {
  await Promise.all(
    tempDirs.splice(0).map(async (tempDir) => {
      await fs.rm(tempDir, { recursive: true, force: true });
    }),
  );
}

async function writeSkillManifest(repoRoot, skillName, manifestBody, extraFiles = []) {
  const skillRoot = path.join(repoRoot, 'skills', skillName);
  await fs.mkdir(path.join(skillRoot, 'evals'), { recursive: true });
  await fs.writeFile(path.join(skillRoot, 'evals', 'evals.json'), manifestBody);

  for (const relativeFile of extraFiles) {
    const targetPath = path.join(skillRoot, relativeFile);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, 'fixture');
  }

  return path.join(skillRoot, 'evals', 'evals.json');
}

test('finds eval manifests while skipping ignored directories', async () => {
  const repoRoot = await makeTempDir();
  await writeSkillManifest(
    repoRoot,
    'alpha',
    JSON.stringify({
      skill_name: 'alpha',
      evals: [{ id: 1, prompt: 'Do alpha.', expected_output: 'Done.', files: [], expectations: ['alpha'] }],
    }),
  );
  await fs.mkdir(path.join(repoRoot, 'node_modules', 'ignored', 'evals'), { recursive: true });
  await fs.writeFile(path.join(repoRoot, 'node_modules', 'ignored', 'evals', 'evals.json'), '{}');
  await fs.mkdir(path.join(repoRoot, 'skills', 'beta', 'notes'), { recursive: true });
  await fs.writeFile(path.join(repoRoot, 'skills', 'beta', 'notes', 'evals.json'), '{}');

  assert.deepEqual(await findEvalManifestPaths(repoRoot), [
    path.join(repoRoot, 'skills', 'alpha', 'evals', 'evals.json'),
  ]);
});

test('rejects malformed JSON content', () => {
  const repoRoot = 'C:/repo';
  const manifestPath = 'C:/repo/skills/alpha/evals/evals.json';
  assert.throws(
    () => validateEvalManifestContent('{"skill_name":"alpha"}\n*** Add File: leaked', manifestPath, repoRoot),
    /Invalid JSON/,
  );
});

test('rejects mismatched skill names', () => {
  const repoRoot = 'C:/repo';
  const manifestPath = 'C:/repo/skills/alpha/evals/evals.json';
  const body = JSON.stringify({
    skill_name: 'beta',
    evals: [{ id: 1, prompt: 'First.', expected_output: 'Done.', files: [], expectations: ['x'] }],
  });

  assert.throws(() => validateEvalManifestContent(body, manifestPath, repoRoot), /must match the skill directory name/);
});

test('rejects duplicate ids and empty eval checks', () => {
  const repoRoot = 'C:/repo';
  const manifestPath = 'C:/repo/skills/alpha/evals/evals.json';
  const body = JSON.stringify({
    skill_name: 'alpha',
    evals: [
      { id: 1, prompt: 'First.', expected_output: 'Done.', files: [] },
      { id: 1, prompt: 'Second.', expected_output: 'Done again.', files: [] },
    ],
  });

  assert.throws(() => validateEvalManifestContent(body, manifestPath, repoRoot), /must be unique/);
  assert.throws(() => validateEvalManifestContent(body, manifestPath, repoRoot), /must include at least one fixture path or expectation/);
});

test('rejects unsafe and duplicate file paths', () => {
  const repoRoot = 'C:/repo';
  const manifestPath = 'C:/repo/skills/alpha/evals/evals.json';
  const body = JSON.stringify({
    skill_name: 'alpha',
    evals: [
      {
        id: 1,
        prompt: 'First.',
        expected_output: 'Done.',
        files: ['../escape.txt', 'fixture.txt', 'fixture.txt'],
      },
    ],
  });

  assert.throws(() => validateEvalManifestContent(body, manifestPath, repoRoot), /must stay within the skill root/);
  assert.throws(() => validateEvalManifestContent(body, manifestPath, repoRoot), /must be unique within the eval/);
});

test('rejects missing fixture files', async () => {
  const repoRoot = await makeTempDir();
  const manifestPath = await writeSkillManifest(
    repoRoot,
    'alpha',
    JSON.stringify({
      skill_name: 'alpha',
      evals: [{ id: 1, prompt: 'Do alpha.', expected_output: 'Done.', files: ['missing.txt'] }],
    }),
  );

  await assert.rejects(validateEvalManifestFile(manifestPath, repoRoot), /references missing file `missing.txt`/);
});

test('validates a repository of well-formed eval manifests with repo-relative files', async () => {
  const repoRoot = await makeTempDir();
  await fs.mkdir(path.join(repoRoot, 'shared'), { recursive: true });
  await fs.writeFile(path.join(repoRoot, 'shared', 'guide.md'), 'repo fixture');

  await writeSkillManifest(
    repoRoot,
    'alpha',
    JSON.stringify({
      skill_name: 'alpha',
      evals: [
        {
          id: 1,
          prompt: 'Do alpha.',
          expected_output: 'Alpha done.',
          files: ['fixtures/example.txt', 'shared/guide.md'],
          expectations: ['Uses the checked-in fixtures.'],
        },
      ],
    }),
    ['fixtures/example.txt'],
  );
  await writeSkillManifest(
    repoRoot,
    'beta',
    JSON.stringify({
      skill_name: 'beta',
      evals: [{ id: 1, prompt: 'Do beta.', expected_output: 'Beta done.', files: [], expectations: ['Responds clearly.'] }],
    }),
  );

  assert.deepEqual(await validateRepoEvalManifests(repoRoot), {
    manifestCount: 2,
    evalCount: 2,
  });
});

test.after(async () => {
  await cleanupTempDirs();
});
