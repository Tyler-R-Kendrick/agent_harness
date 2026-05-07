import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { GitWorktreeBridge, createAddedFilePatch } from './gitWorktreeMiddleware';

function createMockProcess() {
  const process = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    stdin: { end: ReturnType<typeof vi.fn> };
    kill: ReturnType<typeof vi.fn>;
  };
  process.stdout = new PassThrough();
  process.stderr = new PassThrough();
  process.stdin = { end: vi.fn() };
  process.kill = vi.fn();
  return process;
}

function createGitSpawn(outputs: Record<string, { stdout?: string; stderr?: string; code?: number }>) {
  return vi.fn((_command: string, args: string[]) => {
    const process = createMockProcess();
    const key = args.join(' ');
    const output = outputs[key] ?? { stderr: `Unexpected git args: ${key}`, code: 1 };
    queueMicrotask(() => {
      if (output.stdout) process.stdout.write(output.stdout);
      if (output.stderr) process.stderr.write(output.stderr);
      process.stdout.end();
      process.stderr.end();
      process.emit('close', output.code ?? 0);
    });
    return process as never;
  });
}

describe('GitWorktreeBridge', () => {
  it('parses porcelain git status for the current worktree', async () => {
    const spawn = createGitSpawn({
      'rev-parse --show-toplevel': { stdout: 'C:/repo\n' },
      'rev-parse --short HEAD': { stdout: 'abc1234\n' },
      'status --porcelain=v1 -z --branch': {
        stdout: [
          '## main...origin/main [ahead 1, behind 2]',
          ' M src/App.tsx',
          'A  src/new.ts',
          '?? notes/todo.md',
          'R  src/new-name.ts',
          'src/old-name.ts',
          'UU src/conflict.ts',
          '',
        ].join('\0'),
      },
    });
    const bridge = new GitWorktreeBridge({ spawn, cwd: 'C:/repo' });

    await expect(bridge.getStatus()).resolves.toMatchObject({
      available: true,
      cwd: 'C:/repo',
      worktreeRoot: 'C:/repo',
      branch: 'main',
      upstream: 'origin/main',
      head: 'abc1234',
      ahead: 1,
      behind: 2,
      isClean: false,
      summary: {
        changed: 5,
        staged: 3,
        unstaged: 3,
        untracked: 1,
        conflicts: 1,
      },
      files: [
        {
          path: 'src/App.tsx',
          status: 'modified',
          staged: false,
          unstaged: true,
          conflicted: false,
        },
        {
          path: 'src/new.ts',
          status: 'added',
          staged: true,
          unstaged: false,
          conflicted: false,
        },
        {
          path: 'notes/todo.md',
          status: 'untracked',
          staged: false,
          unstaged: true,
          conflicted: false,
        },
        {
          path: 'src/new-name.ts',
          originalPath: 'src/old-name.ts',
          status: 'renamed',
          staged: true,
          unstaged: false,
          conflicted: false,
        },
        {
          path: 'src/conflict.ts',
          status: 'modified',
          staged: true,
          unstaged: true,
          conflicted: true,
        },
      ],
    });
    expect(spawn).toHaveBeenCalledWith('git', ['status', '--porcelain=v1', '-z', '--branch'], expect.objectContaining({ cwd: 'C:/repo' }));
  });

  it('keeps detached worktree status readable', async () => {
    const spawn = createGitSpawn({
      'rev-parse --show-toplevel': { stdout: 'C:/repo\n' },
      'rev-parse --short HEAD': { stdout: 'f00ba47\n' },
      'status --porcelain=v1 -z --branch': {
        stdout: ['## HEAD (no branch)', ' M package.json', ''].join('\0'),
      },
    });
    const bridge = new GitWorktreeBridge({ spawn, cwd: 'C:/repo/worktrees/demo' });

    await expect(bridge.getStatus()).resolves.toMatchObject({
      available: true,
      branch: null,
      head: 'f00ba47',
      files: [{ path: 'package.json', status: 'modified' }],
    });
  });

  it('falls back to the staged diff when the unstaged diff is empty', async () => {
    const patch = [
      'diff --git a/src/App.tsx b/src/App.tsx',
      'index 1111111..2222222 100644',
      '--- a/src/App.tsx',
      '+++ b/src/App.tsx',
      '@@ -1 +1 @@',
      '-old',
      '+new',
      '',
    ].join('\n');
    const spawn = createGitSpawn({
      'diff -- src/App.tsx': { stdout: '' },
      'diff --cached -- src/App.tsx': { stdout: patch },
    });
    const bridge = new GitWorktreeBridge({ spawn, cwd: 'C:/repo' });

    await expect(bridge.getDiff({ path: 'src/App.tsx' })).resolves.toEqual({
      path: 'src/App.tsx',
      patch,
      source: 'staged',
      isBinary: false,
    });
  });

  it('builds a patch for untracked files', () => {
    expect(createAddedFilePatch('notes/todo.md', 'first\nsecond\n')).toContain('+++ b/notes/todo.md\n@@ -0,0 +1,2 @@\n+first\n+second\n');
  });

  it('rejects untracked diff previews outside the worktree root', async () => {
    const spawn = createGitSpawn({
      'diff -- ../repo2/secret.txt': { stdout: '' },
      'diff --cached -- ../repo2/secret.txt': { stdout: '' },
      'status --porcelain=v1 -z -- ../repo2/secret.txt': { stdout: '?? ../repo2/secret.txt\0' },
      'rev-parse --show-toplevel': { stdout: 'C:/repo\n' },
    });
    const bridge = new GitWorktreeBridge({ spawn, cwd: 'C:/repo' });

    await expect(bridge.getDiff({ path: '../repo2/secret.txt' })).rejects.toThrow('outside the worktree');
  });
});
