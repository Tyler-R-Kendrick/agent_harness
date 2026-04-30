import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const GENERATED_ARTIFACT_RULES = [
  {
    label: 'package-lock.json',
    matches: (filePath) => filePath === 'package-lock.json',
  },
  {
    label: 'output/',
    matches: (filePath) => filePath === 'output' || filePath.startsWith('output/'),
  },
  {
    label: '.agentv/cache.json',
    matches: (filePath) => filePath === '.agentv/cache.json',
  },
  {
    label: '.codex/environments/',
    matches: (filePath) => filePath === '.codex/environments' || filePath.startsWith('.codex/environments/'),
  },
  {
    label: '.codex-tk26-objects/',
    matches: (filePath) => filePath === '.codex-tk26-objects' || filePath.startsWith('.codex-tk26-objects/'),
  },
  {
    label: '.codex-tk26-index-*',
    matches: (filePath) => filePath.startsWith('.codex-tk26-index-'),
  },
];

function normalizeGitPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function findTrackedGeneratedArtifacts(trackedFiles, rules = GENERATED_ARTIFACT_RULES) {
  const artifacts = [];
  for (const rawFilePath of trackedFiles) {
    const filePath = normalizeGitPath(rawFilePath);
    const rule = rules.find((candidate) => candidate.matches(filePath));
    if (rule) {
      artifacts.push({ path: filePath, rule: rule.label });
    }
  }
  return artifacts;
}

export function formatTrackedGeneratedArtifactsError(artifacts) {
  const lines = [
    'Generated or local-only artifacts are tracked by git.',
    'Move reusable criteria into source paths, keep run output ignored, and remove these paths from the index:',
    ...artifacts.map((artifact) => `- ${artifact.path} (${artifact.rule})`),
  ];
  return lines.join('\n');
}

export function readTrackedFiles(cwd) {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd,
    encoding: 'buffer',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr.toString('utf8').trim();
    throw new Error(stderr || `git ls-files failed with exit code ${result.status}.`);
  }

  return result.stdout
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

export function checkGeneratedFilesClean(cwd) {
  return findTrackedGeneratedArtifacts(readTrackedFiles(cwd));
}

function defaultRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const artifacts = checkGeneratedFilesClean(defaultRepoRoot());
    if (artifacts.length > 0) {
      process.stderr.write(`${formatTrackedGeneratedArtifactsError(artifacts)}\n`);
      process.exit(1);
    }

    process.stdout.write('No tracked generated artifacts found.\n');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
