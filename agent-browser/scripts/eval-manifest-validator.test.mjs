import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  findEvalManifestPaths,
  runValidation,
  validateManifestFile,
  validateManifestText,
} from './eval-manifest-validator.mjs';

async function withTempDir(run) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'eval-manifest-validator-'));
  await run(tempDir);
}

function manifestPath(rootDir, skillName) {
  return path.join(rootDir, 'skills', skillName, 'evals', 'evals.json');
}

async function writeManifest(rootDir, skillName, content) {
  const target = manifestPath(rootDir, skillName);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
  return target;
}

test('validateManifestText accepts files-based manifests', () => {
  const parsed = validateManifestText(
    JSON.stringify({
      skill_name: 'demo-skill',
      evals: [
        {
          id: 1,
          prompt: 'Fix the bug.',
          expected_output: 'A code fix.',
          files: ['README.md'],
        },
      ],
    }),
    'skills/demo-skill/evals/evals.json',
  );

  assert.equal(parsed.skill_name, 'demo-skill');
  assert.equal(parsed.evals.length, 1);
});

test('validateManifestText accepts expectations-based manifests', () => {
  const parsed = validateManifestText(
    JSON.stringify({
      skill_name: 'demo-skill',
      evals: [
        {
          id: 1,
          prompt: 'Explain the workflow.',
          expected_output: 'A grounded explanation.',
          files: [],
          expectations: ['Mentions the deterministic validator.'],
        },
      ],
    }),
    'skills/demo-skill/evals/evals.json',
  );

  assert.deepEqual(parsed.evals[0].expectations, ['Mentions the deterministic validator.']);
});

test('validateManifestText rejects malformed JSON with trailing residue', () => {
  assert.throws(
    () =>
      validateManifestText(
        '{"skill_name":"demo","evals":[]}\n*** Add File: /tmp/demo.sh',
        'skills/demo/evals/evals.json',
      ),
    /invalid JSON/i,
  );
});

test('validateManifestText rejects duplicate ids', () => {
  assert.throws(
    () =>
      validateManifestText(
        JSON.stringify({
          skill_name: 'demo-skill',
          evals: [
            {
              id: 1,
              prompt: 'A',
              expected_output: 'B',
              files: ['README.md'],
            },
            {
              id: 1,
              prompt: 'C',
              expected_output: 'D',
              files: ['package.json'],
            },
          ],
        }),
        'skills/demo-skill/evals/evals.json',
      ),
    /duplicate eval id 1/i,
  );
});

test('validateManifestText rejects entries without files or expectations', () => {
  assert.throws(
    () =>
      validateManifestText(
        JSON.stringify({
          skill_name: 'demo-skill',
          evals: [
            {
              id: 1,
              prompt: 'A',
              expected_output: 'B',
              files: [],
            },
          ],
        }),
        'skills/demo-skill/evals/evals.json',
      ),
    /at least one file or expectation/i,
  );
});

test('validateManifestFile resolves files relative to the skill or repo root', async () => {
  await withTempDir(async (rootDir) => {
    const repoFile = path.join(rootDir, 'README.md');
    const skillFile = path.join(rootDir, 'skills', 'demo-skill', 'docs', 'guide.md');
    await mkdir(path.dirname(skillFile), { recursive: true });
    await writeFile(repoFile, '# repo');
    await writeFile(skillFile, '# guide');
    const target = await writeManifest(
      rootDir,
      'demo-skill',
      JSON.stringify({
        skill_name: 'demo-skill',
        evals: [
          {
            id: 1,
            prompt: 'A',
            expected_output: 'B',
            files: ['README.md', 'docs/guide.md'],
          },
        ],
      }),
    );

    const previousCwd = process.cwd();
    process.chdir(rootDir);
    try {
      const parsed = await validateManifestFile(target);
      assert.equal(parsed.evals[0].files.length, 2);
    } finally {
      process.chdir(previousCwd);
    }
  });
});

test('validateManifestFile rejects missing files', async () => {
  await withTempDir(async (rootDir) => {
    const target = await writeManifest(
      rootDir,
      'demo-skill',
      JSON.stringify({
        skill_name: 'demo-skill',
        evals: [
          {
            id: 1,
            prompt: 'A',
            expected_output: 'B',
            files: ['missing.md'],
          },
        ],
      }),
    );

    const previousCwd = process.cwd();
    process.chdir(rootDir);
    try {
      await assert.rejects(() => validateManifestFile(target), /references missing file missing\.md/i);
    } finally {
      process.chdir(previousCwd);
    }
  });
});

test('findEvalManifestPaths only returns evals/evals.json manifests', async () => {
  await withTempDir(async (rootDir) => {
    await writeManifest(
      rootDir,
      'demo-a',
      JSON.stringify({
        skill_name: 'demo-a',
        evals: [{ id: 1, prompt: 'A', expected_output: 'B', files: ['README.md'] }],
      }),
    );
    const otherFile = path.join(rootDir, 'skills', 'demo-b', 'notes', 'evals.json');
    await mkdir(path.dirname(otherFile), { recursive: true });
    await writeFile(otherFile, '{}');

    const manifests = await findEvalManifestPaths(path.join(rootDir, 'skills'));
    assert.deepEqual(manifests, [manifestPath(rootDir, 'demo-a')]);
  });
});

test('runValidation reports manifest and eval counts', async () => {
  await withTempDir(async (rootDir) => {
    await writeFile(path.join(rootDir, 'README.md'), '# repo');
    await writeManifest(
      rootDir,
      'demo-a',
      JSON.stringify({
        skill_name: 'demo-a',
        evals: [{ id: 1, prompt: 'A', expected_output: 'B', files: ['README.md'] }],
      }),
    );
    await writeManifest(
      rootDir,
      'demo-b',
      JSON.stringify({
        skill_name: 'demo-b',
        evals: [{ id: 1, prompt: 'A', expected_output: 'B', files: [], expectations: ['C'] }],
      }),
    );

    const result = await runValidation(path.join(rootDir, 'skills'));
    assert.deepEqual(result, { manifestCount: 2, evalCount: 2 });
  });
});
