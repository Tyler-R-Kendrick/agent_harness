export type GitWorktreeFileStatus = 'added' | 'deleted' | 'ignored' | 'modified' | 'renamed' | 'untracked';

export interface GitWorktreeFileChange {
  path: string;
  originalPath?: string;
  status: GitWorktreeFileStatus;
  staged: boolean;
  unstaged: boolean;
  conflicted: boolean;
}

export interface GitWorktreeSummary {
  changed: number;
  staged: number;
  unstaged: number;
  untracked: number;
  conflicts: number;
}

export type GitWorktreeStatusResponse =
  | {
    available: true;
    cwd: string;
    worktreeRoot: string;
    branch: string | null;
    head: string | null;
    upstream: string | null;
    ahead: number;
    behind: number;
    isClean: boolean;
    files: GitWorktreeFileChange[];
    summary: GitWorktreeSummary;
  }
  | {
    available: false;
    error: string;
  };

export interface GitWorktreeDiffResponse {
  path: string;
  patch: string;
  source: 'unstaged' | 'staged' | 'untracked' | 'none';
  isBinary: boolean;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `Request failed with status ${response.status}.`);
  }
  return body;
}

export async function fetchGitWorktreeStatus({
  fetchImpl = fetch,
  signal,
}: {
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
} = {}): Promise<GitWorktreeStatusResponse> {
  return readJsonResponse<GitWorktreeStatusResponse>(await fetchImpl('/api/git-worktree/status', { signal }));
}

export async function fetchGitWorktreeDiff(
  path: string,
  {
    fetchImpl = fetch,
    signal,
  }: {
    fetchImpl?: FetchLike;
    signal?: AbortSignal;
  } = {},
): Promise<GitWorktreeDiffResponse> {
  const search = new URLSearchParams({ path });
  return readJsonResponse<GitWorktreeDiffResponse>(await fetchImpl(`/api/git-worktree/diff?${search.toString()}`, { signal }));
}
