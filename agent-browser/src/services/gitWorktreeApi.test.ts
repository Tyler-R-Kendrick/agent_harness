import { describe, expect, it, vi } from 'vitest';
import { fetchGitWorktreeDiff, fetchGitWorktreeStatus } from './gitWorktreeApi';

function createJsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: vi.fn(async () => body),
  } as unknown as Response;
}

describe('gitWorktreeApi', () => {
  it('fetches git status from the worktree endpoint', async () => {
    const response = {
      available: true,
      worktreeRoot: 'C:/repo',
      cwd: 'C:/repo',
      branch: 'main',
      head: 'abc1234',
      upstream: 'origin/main',
      ahead: 0,
      behind: 0,
      isClean: false,
      files: [{ path: 'src/App.tsx', status: 'modified', staged: false, unstaged: true, conflicted: false }],
      summary: { changed: 1, staged: 0, unstaged: 1, untracked: 0, conflicts: 0 },
    };
    const fetchImpl = vi.fn(async () => createJsonResponse(response));

    await expect(fetchGitWorktreeStatus({ fetchImpl })).resolves.toEqual(response);
    expect(fetchImpl).toHaveBeenCalledWith('/api/git-worktree/status', { signal: undefined });
  });

  it('encodes changed file paths when requesting a diff', async () => {
    const fetchImpl = vi.fn(async () => createJsonResponse({
      path: 'src/App.tsx',
      patch: 'diff --git a/src/App.tsx b/src/App.tsx\n',
      source: 'unstaged',
      isBinary: false,
    }));

    await expect(fetchGitWorktreeDiff('src/App.tsx', { fetchImpl })).resolves.toMatchObject({
      path: 'src/App.tsx',
      source: 'unstaged',
    });
    expect(fetchImpl).toHaveBeenCalledWith('/api/git-worktree/diff?path=src%2FApp.tsx', { signal: undefined });
  });

  it('throws endpoint errors with the server message', async () => {
    const fetchImpl = vi.fn(async () => createJsonResponse({ error: 'not a git repository' }, { ok: false, status: 503 }));

    await expect(fetchGitWorktreeStatus({ fetchImpl })).rejects.toThrow('not a git repository');
  });
});
