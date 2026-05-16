import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const GENERATED_ARTIFACT_RULES = [
  {
    label: 'package-lock.json',
    matches: (filePath) => filePath === 'package-lock.json' || filePath.endsWith('/package-lock.json'),
  },
  {
    label: 'coverage/',
    matches: (filePath) => filePath === 'coverage' || filePath.startsWith('coverage/') || filePath.includes('/coverage/'),
  },
  {
    label: 'playwright-report/',
    matches: (filePath) => filePath === 'playwright-report' || filePath.startsWith('playwright-report/'),
  },
  {
    label: 'test-results/',
    matches: (filePath) => filePath === 'test-results' || filePath.startsWith('test-results/'),
  },
  {
    label: '*.tsbuildinfo',
    matches: (filePath) => filePath.endsWith('.tsbuildinfo'),
  },
  {
    label: '*.log',
    matches: (filePath) => filePath.endsWith('.log'),
  },
  {
    label: '.npm-cache/',
    matches: (filePath) => filePath === '.npm-cache' || filePath.startsWith('.npm-cache/'),
  },
  {
    label: '_cacache/',
    matches: (filePath) => filePath === '_cacache' || filePath.startsWith('_cacache/'),
  },
  {
    label: '_logs/',
    matches: (filePath) => filePath === '_logs' || filePath.startsWith('_logs/'),
  },
  {
    label: '_update-notifier-last-checked',
    matches: (filePath) => filePath === '_update-notifier-last-checked',
  },
  {
    label: 'output/',
    matches: (filePath) => filePath === 'output' || filePath.startsWith('output/'),
  },
  {
    label: '.patches-*/',
    matches: (filePath) => /^\.patches-[^/]+(?:\/|$)/u.test(filePath),
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

export function buildGitLsFilesInvocation(cwd, platform = process.platform) {
  const wrapperPath = path.join(cwd, 'scripts', 'codex-git.ps1');
  if (platform === 'win32') {
    return {
      command: 'powershell',
      args: [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        wrapperPath,
        'ls-files',
        '-z',
      ],
    };
  }

  return {
    command: 'git',
    args: ['ls-files', '-z'],
  };
}

export function readTrackedFiles(cwd) {
  const invocation = buildGitLsFilesInvocation(cwd);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    encoding: 'buffer',
  });

  if (result.error) {
    if (result.error.code === 'EPERM') {
      return readTrackedFilesFromGitIndex(cwd);
    }

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

export function readTrackedFilesFromGitIndex(cwd) {
  const index = readFileSync(resolveGitIndexPath(cwd));
  if (index.toString('ascii', 0, 4) !== 'DIRC') {
    throw new Error('Git index has an unexpected signature.');
  }

  const version = index.readUInt32BE(4);
  if (version !== 2 && version !== 3) {
    throw new Error(`Unsupported git index version ${version}.`);
  }

  const entryCount = index.readUInt32BE(8);
  let offset = 12;
  const files = [];

  for (let entry = 0; entry < entryCount; entry += 1) {
    const entryStart = offset;
    if (entryStart + 62 > index.length) {
      throw new Error('Git index ended before all entries could be read.');
    }

    const flags = index.readUInt16BE(entryStart + 60);
    const hasExtendedFlags = (flags & 0x4000) !== 0;
    let pathStart = entryStart + 62;
    if (hasExtendedFlags) pathStart += 2;

    let pathEnd = pathStart;
    while (pathEnd < index.length && index[pathEnd] !== 0) {
      pathEnd += 1;
    }
    if (pathEnd >= index.length) {
      throw new Error('Git index entry is missing a path terminator.');
    }

    files.push(index.toString('utf8', pathStart, pathEnd));
    offset = entryStart + Math.ceil((pathEnd + 1 - entryStart) / 8) * 8;
  }

  return files;
}

function resolveGitIndexPath(cwd) {
  const gitPath = path.join(cwd, '.git');
  if (!existsSync(gitPath)) {
    throw new Error(`No .git path found at ${gitPath}.`);
  }

  if (statSync(gitPath).isDirectory()) {
    return path.join(gitPath, 'index');
  }

  const gitFile = readFileSync(gitPath, 'utf8');
  if (gitFile.startsWith('gitdir:')) {
    const gitDir = gitFile.trim().replace(/^gitdir:\s*/u, '');
    return path.join(path.resolve(cwd, gitDir), 'index');
  }

  throw new Error(`Unsupported .git file format at ${gitPath}.`);
}

export function checkGeneratedFilesClean(cwd) {
  return findTrackedGeneratedArtifacts(filterExistingTrackedFiles(readTrackedFiles(cwd), cwd));
}

export function readTrackedFilesFromLineInput(input) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function filterExistingTrackedFiles(trackedFiles, cwd) {
  return trackedFiles.filter((filePath) => existsSync(path.join(cwd, normalizeGitPath(filePath))));
}

function defaultRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const trackedFiles = process.argv.includes('--stdin-lines')
      ? readTrackedFilesFromLineInput(readFileSync(0, 'utf8'))
      : readTrackedFiles(defaultRepoRoot());
    const artifacts = findTrackedGeneratedArtifacts(filterExistingTrackedFiles(trackedFiles, defaultRepoRoot()));
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
