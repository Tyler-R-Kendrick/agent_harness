export interface GitStubFileSystem {
  getAllPaths(): string[];
  readFile(path: string, encoding?: string): Promise<string | Uint8Array>;
  writeFile(path: string, content: string, encoding?: string): Promise<void>;
  mkdir?(path: string, options?: { recursive?: boolean }): Promise<void>;
}

export interface GitStubRepository {
  fs: GitStubFileSystem;
  cwd: string;
  rootPath: string;
  now: () => Date;
}

export interface GitStubCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  cwd: string;
}

export interface GitStubCommit {
  id: string;
  branch: string;
  message: string;
  parentIds: string[];
  files: Record<string, string>;
  createdAt: string;
}

export interface GitStubBranch {
  head: string | null;
}

export interface GitStubState {
  version: 1;
  rootPath: string;
  currentBranch: string;
  branches: Record<string, GitStubBranch>;
  commits: Record<string, GitStubCommit>;
  index: Record<string, string>;
  initializedAt: string;
}
