import assert from 'node:assert/strict';

const { createGitStubRepository, executeGitStubCommand } = await import('../../lib/git-stub/src/repository.ts');

class MemoryGitStubFileSystem {
  files = new Map();
  paths = new Set(['/workspace']);

  constructor(seed = {}) {
    for (const [path, content] of Object.entries(seed)) {
      this.writeFileSync(path, content);
    }
  }

  getAllPaths() {
    return [...this.paths].sort();
  }

  async readFile(path) {
    if (!this.files.has(path)) {
      throw new Error(`Missing file: ${path}`);
    }
    return this.files.get(path) ?? '';
  }

  async writeFile(path, content = '') {
    this.writeFileSync(path, content);
  }

  async mkdir(path) {
    this.paths.add(path);
  }

  writeFileSync(path, content) {
    const parts = path.split('/').filter(Boolean);
    let cursor = '';
    for (const part of parts.slice(0, -1)) {
      cursor += `/${part}`;
      this.paths.add(cursor);
    }
    this.paths.add(path);
    this.files.set(path, content);
  }
}

const fs = new MemoryGitStubFileSystem({
  '/workspace/README.md': 'hello',
});
const repo = createGitStubRepository({
  fs,
  cwd: '/workspace',
  now: () => new Date('2026-05-09T14:00:00.000Z'),
});

assert.equal((await executeGitStubCommand(repo, 'git status')).exitCode, 128);
assert.equal(
  (await executeGitStubCommand(repo, 'git init')).stdout,
  'Initialized empty git-stub repository in /workspace/.git-stub',
);
assert.equal(
  (await executeGitStubCommand(repo, 'git status')).stdout,
  ['On branch main', 'Untracked files:', '  README.md', '', 'nothing staged for commit'].join('\n'),
);
assert.equal((await executeGitStubCommand(repo, 'git add README.md')).stdout, 'staged README.md');
assert.equal(
  (await executeGitStubCommand(repo, 'git status')).stdout,
  ['On branch main', 'Changes to be committed:', '  added: README.md', '', 'working tree clean'].join('\n'),
);
assert.equal(
  (await executeGitStubCommand(repo, 'git commit -m "initial notes"')).stdout,
  '[main 6a4cac3] initial notes\n 1 file changed',
);
assert.equal((await executeGitStubCommand(repo, 'git log --oneline')).stdout, '6a4cac3 initial notes');

const branchFs = new MemoryGitStubFileSystem({
  '/workspace/app.ts': 'export const value = 1;\n',
});
const branchRepo = createGitStubRepository({
  fs: branchFs,
  cwd: '/workspace',
  now: () => new Date('2026-05-09T14:05:00.000Z'),
});
await executeGitStubCommand(branchRepo, 'git init');
await executeGitStubCommand(branchRepo, 'git add .');
await executeGitStubCommand(branchRepo, 'git commit -m baseline');
await branchFs.writeFile('/workspace/app.ts', 'export const value = 2;\n');
assert.equal((await executeGitStubCommand(branchRepo, 'git status --short')).stdout, ' M app.ts');
assert.equal((await executeGitStubCommand(branchRepo, 'git diff')).stdout, 'modified app.ts');
await executeGitStubCommand(branchRepo, 'git add app.ts');
assert.equal((await executeGitStubCommand(branchRepo, 'git status --short')).stdout, 'M  app.ts');
assert.equal((await executeGitStubCommand(branchRepo, 'git checkout -b experiment')).stdout, 'Switched to a new branch experiment');
assert.equal((await executeGitStubCommand(branchRepo, 'git branch')).stdout, '  main\n* experiment');

console.log('git-stub smoke passed');
