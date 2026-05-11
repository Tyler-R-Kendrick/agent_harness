import { describe, expect, it } from 'vitest';

import { createGitStubRepository, executeGitStubCommand, isGitStubCommand } from '../repository.js';
import type { GitStubFileSystem } from '../types.js';

class MemoryGitStubFileSystem implements GitStubFileSystem {
  private readonly files = new Map<string, string>();
  private readonly paths = new Set<string>(['/workspace']);

  constructor(seed: Record<string, string> = {}) {
    for (const [path, content] of Object.entries(seed)) {
      this.writeFileSync(path, content);
    }
  }

  getAllPaths() {
    return [...this.paths].sort();
  }

  async readFile(path: string) {
    if (!this.files.has(path)) {
      throw new Error(`Missing file: ${path}`);
    }
    return this.files.get(path) ?? '';
  }

  async writeFile(path: string, content = '') {
    this.writeFileSync(path, content);
  }

  async mkdir(path: string) {
    this.paths.add(path);
  }

  deleteFile(path: string) {
    this.files.delete(path);
    this.paths.delete(path);
  }

  private writeFileSync(path: string, content: string) {
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

class BinaryGitStubFileSystem extends MemoryGitStubFileSystem {
  override async readFile(path: string) {
    const content = await super.readFile(path);
    return new TextEncoder().encode(content);
  }
}

class FlatGitStubFileSystem extends MemoryGitStubFileSystem {
  override async mkdir() {
    return undefined;
  }
}

describe('git-stub repository', () => {
  it('tracks status, staging, commits, and log entries inside the session filesystem', async () => {
    const fs = new MemoryGitStubFileSystem({
      '/workspace/README.md': 'hello',
    });
    const repo = createGitStubRepository({ fs, cwd: '/workspace', now: () => new Date('2026-05-09T14:00:00.000Z') });

    expect(await executeGitStubCommand(repo, 'git status')).toMatchObject({
      exitCode: 128,
      stderr: 'fatal: not a git-stub repository (or any parent up to /workspace)',
    });

    expect(await executeGitStubCommand(repo, 'git init')).toMatchObject({
      exitCode: 0,
      stdout: 'Initialized empty git-stub repository in /workspace/.git-stub',
    });
    expect(await executeGitStubCommand(repo, 'git status')).toMatchObject({
      exitCode: 0,
      stdout: [
        'On branch main',
        'Untracked files:',
        '  README.md',
        '',
        'nothing staged for commit',
      ].join('\n'),
    });

    expect(await executeGitStubCommand(repo, 'git add README.md')).toMatchObject({
      exitCode: 0,
      stdout: 'staged README.md',
    });
    expect(await executeGitStubCommand(repo, 'git diff --cached')).toMatchObject({
      exitCode: 0,
      stdout: 'added README.md',
    });
    expect(await executeGitStubCommand(repo, 'git status')).toMatchObject({
      exitCode: 0,
      stdout: [
        'On branch main',
        'Changes to be committed:',
        '  added: README.md',
        '',
        'working tree clean',
      ].join('\n'),
    });

    expect(await executeGitStubCommand(repo, 'git commit -m "initial notes"')).toMatchObject({
      exitCode: 0,
      stdout: '[main 6a4cac3] initial notes\n 1 file changed',
    });
    expect(await executeGitStubCommand(repo, 'git log --oneline')).toMatchObject({
      exitCode: 0,
      stdout: '6a4cac3 initial notes',
    });
    expect(await executeGitStubCommand(repo, 'git status')).toMatchObject({
      exitCode: 0,
      stdout: 'On branch main\nnothing to commit, working tree clean',
    });
  });

  it('reports unstaged, staged, and branch changes without passing through a real git binary', async () => {
    const fs = new MemoryGitStubFileSystem({
      '/workspace/app.ts': 'export const value = 1;\n',
    });
    const repo = createGitStubRepository({ fs, cwd: '/workspace', now: () => new Date('2026-05-09T14:05:00.000Z') });

    await executeGitStubCommand(repo, 'git init');
    await executeGitStubCommand(repo, 'git add .');
    await executeGitStubCommand(repo, 'git commit -m baseline');
    await fs.writeFile('/workspace/app.ts', 'export const value = 2;\n');

    expect(await executeGitStubCommand(repo, 'git status --short')).toMatchObject({
      exitCode: 0,
      stdout: ' M app.ts',
    });
    expect(await executeGitStubCommand(repo, 'git status')).toMatchObject({
      exitCode: 0,
      stdout: [
        'On branch main',
        'Changes not staged for commit:',
        '  modified: app.ts',
        '',
        'nothing staged for commit',
      ].join('\n'),
    });
    expect(await executeGitStubCommand(repo, 'git diff')).toMatchObject({
      exitCode: 0,
      stdout: 'modified app.ts',
    });

    await executeGitStubCommand(repo, 'git add app.ts');
    await fs.writeFile('/workspace/app.ts', 'export const value = 3;\n');
    expect(await executeGitStubCommand(repo, 'git status --short')).toMatchObject({
      exitCode: 0,
      stdout: 'M  app.ts\n M app.ts',
    });
    expect(await executeGitStubCommand(repo, 'git status')).toMatchObject({
      stdout: [
        'On branch main',
        'Changes to be committed:',
        '  modified: app.ts',
        '',
        'Changes not staged for commit:',
        '  modified: app.ts',
      ].join('\n'),
    });
    expect(await executeGitStubCommand(repo, 'git checkout -b experiment')).toMatchObject({
      exitCode: 0,
      stdout: 'Switched to a new branch experiment',
    });
    expect(await executeGitStubCommand(repo, 'git branch')).toMatchObject({
      exitCode: 0,
      stdout: '  main\n* experiment',
    });
  });

  it('reports deleted tracked files as unstaged status and diff entries', async () => {
    const fs = new MemoryGitStubFileSystem({
      '/workspace/app.ts': 'export const value = 1;\n',
      '/workspace/readme.md': 'notes\n',
    });
    const repo = createGitStubRepository({ fs, cwd: '/workspace' });

    await executeGitStubCommand(repo, 'git init');
    await executeGitStubCommand(repo, 'git add .');
    await executeGitStubCommand(repo, 'git commit -m baseline');
    fs.deleteFile('/workspace/app.ts');

    expect(await executeGitStubCommand(repo, 'git status --short')).toMatchObject({
      exitCode: 0,
      stdout: ' D app.ts',
    });
    expect(await executeGitStubCommand(repo, 'git status')).toMatchObject({
      exitCode: 0,
      stdout: [
        'On branch main',
        'Changes not staged for commit:',
        '  deleted: app.ts',
        '',
        'nothing staged for commit',
      ].join('\n'),
    });
    expect(await executeGitStubCommand(repo, 'git diff')).toMatchObject({
      exitCode: 0,
      stdout: 'deleted app.ts',
    });
  });

  it('handles command parsing, reinitialization, checkout errors, and unsupported commands', async () => {
    expect(isGitStubCommand('git status')).toBe(true);
    expect(isGitStubCommand('git ')).toBe(true);
    expect(isGitStubCommand('printf git')).toBe(false);

    const fs = new MemoryGitStubFileSystem({
      '/workspace/src/app.ts': 'one',
    });
    const repo = createGitStubRepository({ fs, cwd: '/workspace/src' });

    expect(await executeGitStubCommand(repo, 'printf git')).toMatchObject({
      exitCode: 127,
      stderr: 'git-stub can only execute git commands: printf git',
    });
    expect(await executeGitStubCommand(repo, 'git init')).toMatchObject({
      stdout: 'Initialized empty git-stub repository in /workspace/.git-stub',
    });
    expect(await executeGitStubCommand(repo, 'git')).toMatchObject({
      exitCode: 1,
      stderr: 'git-stub: unsupported command "git help"',
    });
    expect(await executeGitStubCommand(repo, 'git init')).toMatchObject({
      stdout: 'Reinitialized existing git-stub repository in /workspace/.git-stub',
    });
    expect(await executeGitStubCommand(repo, 'git add')).toMatchObject({
      exitCode: 1,
      stderr: 'Nothing specified, nothing added.',
    });
    expect(await executeGitStubCommand(repo, 'git add missing.ts')).toMatchObject({
      exitCode: 1,
      stderr: 'pathspec did not match any files',
    });
    expect(await executeGitStubCommand(repo, 'git commit -m')).toMatchObject({
      exitCode: 1,
      stderr: 'Aborting commit due to empty commit message.',
    });
    expect(await executeGitStubCommand(repo, 'git commit')).toMatchObject({
      exitCode: 1,
      stderr: 'Aborting commit due to empty commit message.',
    });
    expect(await executeGitStubCommand(repo, 'git commit -m noop')).toMatchObject({
      stdout: 'On branch main\nnothing to commit, working tree clean',
    });
    expect(await executeGitStubCommand(createGitStubRepository({ fs, cwd: '/tmp' }), 'git add src/app.ts')).toMatchObject({
      exitCode: 0,
      stdout: 'staged src/app.ts',
    });
    await fs.writeFile('/workspace/src/extra.ts', 'extra');
    expect(await executeGitStubCommand(repo, 'git status')).toMatchObject({
      stdout: expect.stringContaining('\nUntracked files:\n  src/extra.ts'),
    });
    expect(await executeGitStubCommand(repo, 'git checkout')).toMatchObject({
      exitCode: 1,
      stderr: 'fatal: checkout requires a branch name',
    });
    expect(await executeGitStubCommand(repo, 'git checkout missing')).toMatchObject({
      exitCode: 1,
      stderr: 'error: pathspec "missing" did not match any branch',
    });
    expect(await executeGitStubCommand(repo, 'git checkout -b')).toMatchObject({
      exitCode: 1,
      stderr: 'fatal: git checkout -b requires a branch name',
    });
    expect(await executeGitStubCommand(repo, 'git checkout -b main')).toMatchObject({
      exitCode: 1,
      stderr: 'fatal: a branch named "main" already exists',
    });
    expect(await executeGitStubCommand(repo, 'git frobnicate')).toMatchObject({
      exitCode: 1,
      stderr: 'git-stub: unsupported command "git frobnicate"',
    });
  });

  it('supports nested pathspecs, cached diffs, full logs, binary reads, and follow-up commits', async () => {
    const fs = new BinaryGitStubFileSystem({
      '/workspace/src/app.ts': 'export const value = 1;\n',
      '/workspace/src/util.ts': 'export const util = true;\n',
    });
    const repo = createGitStubRepository({ fs, cwd: '/workspace/src', now: () => new Date('2026-05-09T15:00:00.000Z') });

    await executeGitStubCommand(repo, 'git init');
    expect(await executeGitStubCommand(repo, 'git status --short')).toMatchObject({
      stdout: '?? src/app.ts\n?? src/util.ts',
    });
    expect(await executeGitStubCommand(repo, 'git add /src/app.ts')).toMatchObject({
      stdout: 'staged src/app.ts',
    });
    expect(await executeGitStubCommand(repo, 'git status --short')).toMatchObject({
      stdout: 'A  src/app.ts\n?? src/util.ts',
    });
    expect(await executeGitStubCommand(repo, 'git add /workspace/src')).toMatchObject({
      stdout: 'staged src/app.ts, src/util.ts',
    });
    expect(await executeGitStubCommand(repo, 'git commit --message "baseline snapshot"')).toMatchObject({
      stdout: '[main 6a4cac3] baseline snapshot\n 2 files changed',
    });
    await fs.writeFile('/workspace/src/app.ts', 'export const value = 2;\n');
    await executeGitStubCommand(repo, 'git add app.ts');

    expect(await executeGitStubCommand(repo, 'git diff --cached')).toMatchObject({
      stdout: 'modified src/app.ts',
    });
    expect(await executeGitStubCommand(repo, 'git commit -msecond')).toMatchObject({
      exitCode: 0,
    });
    expect(await executeGitStubCommand(repo, 'git diff')).toMatchObject({
      stdout: '',
    });
    await fs.writeFile('/workspace/src/util.ts', 'export const util = false;\n');
    await executeGitStubCommand(repo, 'git add util.ts');
    expect(await executeGitStubCommand(repo, "git    commit    -m    'third pass'")).toMatchObject({
      stdout: expect.stringContaining('third pass'),
    });
    expect(await executeGitStubCommand(repo, 'git log')).toMatchObject({
      stdout: expect.stringContaining('commit '),
    });
    expect(await executeGitStubCommand(repo, 'git log')).toMatchObject({
      stdout: expect.stringContaining('    second'),
    });
    await executeGitStubCommand(repo, 'git switch -b release');
    expect(await executeGitStubCommand(repo, 'git switch main')).toMatchObject({
      stdout: 'Switched to branch main',
    });
  });

  it('recovers from invalid state and supports filesystems without mkdir', async () => {
    const invalidFs = new MemoryGitStubFileSystem({
      '/workspace/.git-stub/state.json': '{"version":2}',
    });
    expect(await executeGitStubCommand(createGitStubRepository({ fs: invalidFs }), 'git status')).toMatchObject({
      exitCode: 128,
      stderr: 'fatal: not a git-stub repository (or any parent up to /workspace)',
    });

    const flatFs = new FlatGitStubFileSystem({
      '/workspace/readme.md': 'hello',
    });
    const repo = createGitStubRepository({ fs: flatFs, rootPath: 'workspace' });
    expect(await executeGitStubCommand(repo, 'git init')).toMatchObject({
      stdout: 'Initialized empty git-stub repository in /workspace/.git-stub',
    });
  });

  it('handles malformed and incomplete persisted state defensively', async () => {
    const arrayStateFs = new MemoryGitStubFileSystem({
      '/workspace/.git-stub/state.json': '[]',
    });
    expect(await executeGitStubCommand(createGitStubRepository({ fs: arrayStateFs }), 'git status')).toMatchObject({
      exitCode: 128,
    });

    const missingCommitFs = new MemoryGitStubFileSystem({
      '/workspace/.git-stub/state.json': JSON.stringify({
        version: 1,
        rootPath: '/workspace',
        currentBranch: 'main',
        branches: { main: { head: 'missing' } },
        commits: {},
        index: {},
        initializedAt: '2026-05-09T15:30:00.000Z',
      }),
    });
    expect(await executeGitStubCommand(createGitStubRepository({ fs: missingCommitFs }), 'git log')).toMatchObject({
      stdout: '',
    });
    expect(await executeGitStubCommand(createGitStubRepository({ fs: missingCommitFs }), 'git status --short')).toMatchObject({
      stdout: 'clean',
    });

    const missingBranchFs = new MemoryGitStubFileSystem({
      '/workspace/a.txt': 'a',
      '/workspace/.git-stub/state.json': JSON.stringify({
        version: 1,
        rootPath: '/workspace',
        currentBranch: 'detached',
        branches: { main: { head: null } },
        commits: {
          seed: {
            id: 'seed',
            branch: 'main',
            message: 'seed',
            parentIds: [],
            files: {},
            createdAt: '2026-05-09T15:00:00.000Z',
          },
        },
        index: { 'a.txt': 'a' },
        initializedAt: '2026-05-09T15:30:00.000Z',
      }),
    });
    expect(await executeGitStubCommand(createGitStubRepository({ fs: missingBranchFs }), 'git log')).toMatchObject({
      stdout: '',
    });
    const missingBranchCheckoutFs = new MemoryGitStubFileSystem({
      '/workspace/.git-stub/state.json': JSON.stringify({
        version: 1,
        rootPath: '/workspace',
        currentBranch: 'detached',
        branches: { main: { head: null } },
        commits: {},
        index: {},
        initializedAt: '2026-05-09T15:30:00.000Z',
      }),
    });
    expect(await executeGitStubCommand(createGitStubRepository({ fs: missingBranchCheckoutFs }), 'git checkout -b recovered')).toMatchObject({
      stdout: 'Switched to a new branch recovered',
    });
    expect(await executeGitStubCommand(createGitStubRepository({ fs: missingBranchFs }), 'git commit -m detached')).toMatchObject({
      stdout: expect.stringMatching(/^\[detached [0-9a-f]{7}\] detached\n 1 file changed$/),
    });
  });
});
