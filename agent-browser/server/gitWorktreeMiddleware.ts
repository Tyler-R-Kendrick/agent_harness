import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

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

type SpawnLike = (command: string, args: string[], options: SpawnOptionsWithoutStdio) => ChildProcessWithoutNullStreams;

type RunGitResult = {
  stdout: string;
  stderr: string;
};

type BranchState = {
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
};

const EMPTY_SUMMARY: GitWorktreeSummary = Object.freeze({
  changed: 0,
  staged: 0,
  unstaged: 0,
  untracked: 0,
  conflicts: 0,
});

export class GitWorktreeBridge {
  private readonly spawn: SpawnLike;

  private readonly command: string;

  private readonly cwd: string;

  constructor({
    spawn = nodeSpawn,
    command = 'git',
    cwd = process.env.INIT_CWD || process.cwd(),
  }: {
    spawn?: SpawnLike;
    command?: string;
    cwd?: string;
  } = {}) {
    this.spawn = spawn;
    this.command = command;
    this.cwd = cwd;
  }

  async getStatus(): Promise<GitWorktreeStatusResponse> {
    try {
      const worktreeRoot = (await this.runGit(['rev-parse', '--show-toplevel'])).stdout.trim();
      const [headResult, statusResult] = await Promise.all([
        this.runGit(['rev-parse', '--short', 'HEAD']),
        this.runGit(['status', '--porcelain=v1', '-z', '--branch']),
      ]);
      const branch = parseBranchStatus(statusResult.stdout);
      const files = parsePorcelainStatus(statusResult.stdout);
      const summary = summarizeChanges(files);
      return {
        available: true,
        cwd: this.cwd,
        worktreeRoot,
        branch: branch.branch,
        head: headResult.stdout.trim() || null,
        upstream: branch.upstream,
        ahead: branch.ahead,
        behind: branch.behind,
        isClean: files.length === 0,
        files,
        summary,
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Git status is unavailable for this worktree.',
      };
    }
  }

  async getDiff({ path: filePath }: { path: string }): Promise<GitWorktreeDiffResponse> {
    const unstaged = await this.runGit(['diff', '--', filePath]);
    if (unstaged.stdout.trim()) {
      return createDiffResponse(filePath, unstaged.stdout, 'unstaged');
    }

    const staged = await this.runGit(['diff', '--cached', '--', filePath]);
    if (staged.stdout.trim()) {
      return createDiffResponse(filePath, staged.stdout, 'staged');
    }

    const status = parsePorcelainStatus((await this.runGit(['status', '--porcelain=v1', '-z', '--', filePath])).stdout)[0];
    if (status?.status === 'untracked') {
      const worktreeRoot = (await this.runGit(['rev-parse', '--show-toplevel'])).stdout.trim();
      const absolutePath = path.resolve(worktreeRoot, filePath);
      const normalizedRoot = path.resolve(worktreeRoot);
      const relativePath = path.relative(normalizedRoot, absolutePath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error('Requested path is outside the worktree.');
      }
      const contents = await readFile(absolutePath, 'utf-8');
      return createDiffResponse(filePath, createAddedFilePatch(filePath, contents), 'untracked');
    }

    return createDiffResponse(filePath, '', 'none');
  }

  private runGit(args: string[]): Promise<RunGitResult> {
    return new Promise((resolve, reject) => {
      const child = this.spawn(this.command, args, {
        cwd: this.cwd,
        env: process.env,
      });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString('utf-8');
      });
      child.stderr.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString('utf-8');
      });
      child.on('error', (error) => reject(error));
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }
        reject(new Error((stderr || stdout || `git ${args.join(' ')} exited with code ${code}`).trim()));
      });
    });
  }
}

function parseBranchStatus(output: string): BranchState {
  const branchLine = output.split('\0').find((entry) => entry.startsWith('## ')) ?? '';
  const body = branchLine.slice(3).trim();
  if (!body) return { branch: null, upstream: null, ahead: 0, behind: 0 };

  const metadataMatch = body.match(/\[(?<metadata>[^\]]+)\]/);
  const metadata = metadataMatch?.groups?.metadata ?? '';
  const withoutMetadata = body.replace(/\s*\[[^\]]+\]\s*$/, '');
  const [branchLabel, upstreamLabel] = withoutMetadata.split('...');
  const branch = branchLabel === 'HEAD (no branch)' ? null : branchLabel || null;
  const ahead = Number(metadata.match(/ahead (?<count>\d+)/)?.groups?.count ?? 0);
  const behind = Number(metadata.match(/behind (?<count>\d+)/)?.groups?.count ?? 0);

  return {
    branch,
    upstream: upstreamLabel || null,
    ahead,
    behind,
  };
}

function parsePorcelainStatus(output: string): GitWorktreeFileChange[] {
  const records = output.split('\0').filter(Boolean);
  const files: GitWorktreeFileChange[] = [];
  for (let index = records[0]?.startsWith('## ') ? 1 : 0; index < records.length; index += 1) {
    const record = records[index];
    if (record.length < 4) continue;
    const indexStatus = record[0] ?? ' ';
    const worktreeStatus = record[1] ?? ' ';
    const filePath = record.slice(3);
    const status = mapStatus(indexStatus, worktreeStatus);
    const renamed = indexStatus === 'R' || worktreeStatus === 'R' || indexStatus === 'C' || worktreeStatus === 'C';
    const conflicted = isConflictStatus(indexStatus, worktreeStatus);
    const originalPath = renamed ? records[index + 1] : undefined;
    if (renamed) index += 1;
    files.push({
      path: filePath,
      originalPath,
      status,
      staged: (indexStatus !== ' ' && indexStatus !== '?') || conflicted,
      unstaged: worktreeStatus !== ' ' || indexStatus === '?' || conflicted,
      conflicted,
    });
  }
  return files;
}

function mapStatus(indexStatus: string, worktreeStatus: string): GitWorktreeFileStatus {
  const combined = `${indexStatus}${worktreeStatus}`;
  if (combined.includes('?')) return 'untracked';
  if (combined.includes('!')) return 'ignored';
  if (combined.includes('R') || combined.includes('C')) return 'renamed';
  if (combined.includes('A')) return 'added';
  if (combined.includes('D')) return 'deleted';
  return 'modified';
}

function isConflictStatus(indexStatus: string, worktreeStatus: string): boolean {
  return indexStatus === 'U'
    || worktreeStatus === 'U'
    || (indexStatus === 'A' && worktreeStatus === 'A')
    || (indexStatus === 'D' && worktreeStatus === 'D');
}

function summarizeChanges(files: GitWorktreeFileChange[]): GitWorktreeSummary {
  if (!files.length) return { ...EMPTY_SUMMARY };
  return files.reduce<GitWorktreeSummary>((summary, file) => ({
    changed: summary.changed + 1,
    staged: summary.staged + (file.staged ? 1 : 0),
    unstaged: summary.unstaged + (file.unstaged ? 1 : 0),
    untracked: summary.untracked + (file.status === 'untracked' ? 1 : 0),
    conflicts: summary.conflicts + (file.conflicted ? 1 : 0),
  }), { ...EMPTY_SUMMARY });
}

function createDiffResponse(filePath: string, patch: string, source: GitWorktreeDiffResponse['source']): GitWorktreeDiffResponse {
  return {
    path: filePath,
    patch,
    source,
    isBinary: patch.includes('GIT binary patch') || patch.includes('Binary files '),
  };
}

export function createAddedFilePatch(filePath: string, contents: string): string {
  const normalized = contents.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.length === 0
    ? []
    : normalized.endsWith('\n')
      ? normalized.slice(0, -1).split('\n')
      : normalized.split('\n');
  const addedLines = lines.map((line) => `+${line}`).join('\n');
  const hunk = lines.length > 0 ? `@@ -0,0 +1,${lines.length} @@\n${addedLines}\n` : '@@ -0,0 +0,0 @@\n';
  return [
    `diff --git a/${filePath} b/${filePath}`,
    'new file mode 100644',
    'index 0000000..0000000',
    '--- /dev/null',
    `+++ b/${filePath}`,
    hunk,
  ].join('\n');
}

const bridge = new GitWorktreeBridge();

function writeJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function createGitWorktreeApiMiddleware(worktreeBridge = bridge) {
  return async (req: IncomingMessage, res: ServerResponse, next: (error?: Error) => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/git-worktree/status' && url.pathname !== '/api/git-worktree/diff') {
      next();
      return;
    }

    try {
      if (req.method === 'GET' && url.pathname === '/api/git-worktree/status') {
        const status = await worktreeBridge.getStatus();
        writeJson(res, status.available ? 200 : 503, status);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/git-worktree/diff') {
        const filePath = url.searchParams.get('path');
        if (!filePath) {
          writeJson(res, 400, { error: 'path is required.' });
          return;
        }
        writeJson(res, 200, await worktreeBridge.getDiff({ path: filePath }));
        return;
      }

      writeJson(res, 405, { error: 'Method not allowed.' });
    } catch (error) {
      next(error instanceof Error ? error : new Error('Git worktree middleware failed.'));
    }
  };
}
