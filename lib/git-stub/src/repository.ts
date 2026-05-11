import type {
  GitStubCommandResult,
  GitStubCommit,
  GitStubFileSystem,
  GitStubRepository,
  GitStubState,
} from './types.js';

const STATE_DIR = '.git-stub';
const STATE_FILE = 'state.json';
const DEFAULT_BRANCH = 'main';

type StatusEntryKind = 'added' | 'modified' | 'deleted';

interface StatusEntry {
  path: string;
  kind: StatusEntryKind;
}

export function createGitStubRepository(input: {
  fs: GitStubFileSystem;
  cwd?: string | null;
  rootPath?: string;
  now?: () => Date;
}): GitStubRepository {
  return {
    fs: input.fs,
    cwd: normalizeAbsolutePath(input.cwd || input.rootPath || '/workspace'),
    rootPath: normalizeAbsolutePath(input.rootPath ?? '/workspace'),
    now: input.now ?? (() => new Date()),
  };
}

export function isGitStubCommand(command: string): boolean {
  const tokens = tokenize(command);
  return tokens[0] === 'git';
}

export async function executeGitStubCommand(
  repo: GitStubRepository,
  command: string,
): Promise<GitStubCommandResult> {
  const tokens = tokenize(command);
  if (tokens[0] !== 'git') {
    return failure(repo, `git-stub can only execute git commands: ${command}`, 127);
  }

  const subcommand = tokens[1] ?? 'help';
  if (subcommand === 'init') {
    return initializeRepository(repo);
  }

  const state = await readState(repo);
  if (!state) {
    return failure(repo, `fatal: not a git-stub repository (or any parent up to ${repo.rootPath})`, 128);
  }

  switch (subcommand) {
    case 'status':
      return success(repo, await formatStatus(repo, state, tokens.includes('--short')));
    case 'add':
      return addPaths(repo, state, tokens.slice(2));
    case 'commit':
      return commit(repo, state, parseCommitMessage(tokens.slice(2)));
    case 'log':
      return success(repo, formatLog(state, tokens.includes('--oneline')));
    case 'diff':
      return success(repo, await formatDiff(repo, state, tokens.includes('--cached')));
    case 'branch':
      return success(repo, formatBranches(state));
    case 'checkout':
    case 'switch':
      return checkout(repo, state, tokens.slice(2));
    default:
      return failure(repo, `git-stub: unsupported command "git ${subcommand}"`, 1);
  }
}

async function initializeRepository(repo: GitStubRepository): Promise<GitStubCommandResult> {
  const existing = await readState(repo);
  if (existing) {
    return success(repo, `Reinitialized existing git-stub repository in ${stateDirPath(repo)}`);
  }

  const state: GitStubState = {
    version: 1,
    rootPath: repo.rootPath,
    currentBranch: DEFAULT_BRANCH,
    branches: {
      [DEFAULT_BRANCH]: { head: null },
    },
    commits: {},
    index: {},
    initializedAt: repo.now().toISOString(),
  };
  await writeState(repo, state);
  return success(repo, `Initialized empty git-stub repository in ${stateDirPath(repo)}`);
}

async function addPaths(
  repo: GitStubRepository,
  state: GitStubState,
  rawPaths: string[],
): Promise<GitStubCommandResult> {
  if (!rawPaths.length) {
    return failure(repo, 'Nothing specified, nothing added.', 1);
  }

  const workingFiles = await readWorkingFiles(repo);
  const selectedPaths = expandPathspecs(repo, workingFiles, rawPaths);
  if (!selectedPaths.length) {
    return failure(repo, 'pathspec did not match any files', 1);
  }

  const nextState: GitStubState = {
    ...state,
    index: { ...state.index },
  };
  for (const path of selectedPaths) {
    nextState.index[path] = workingFiles[path]!;
  }
  await writeState(repo, nextState);

  return success(repo, `staged ${selectedPaths.join(', ')}`);
}

async function commit(
  repo: GitStubRepository,
  state: GitStubState,
  message: string | null,
): Promise<GitStubCommandResult> {
  if (!message) {
    return failure(repo, 'Aborting commit due to empty commit message.', 1);
  }
  const staged = getStagedEntries(state);
  if (!staged.length) {
    return success(repo, `On branch ${state.currentBranch}\nnothing to commit, working tree clean`);
  }

  const parentId = state.branches[state.currentBranch]?.head ?? null;
  const parentFiles = getHeadFiles(state);
  const files = {
    ...parentFiles,
    ...state.index,
  };
  const id = createCommitId(state, state.currentBranch, message, files);
  const commitEntry: GitStubCommit = {
    id,
    branch: state.currentBranch,
    message,
    parentIds: parentId ? [parentId] : [],
    files,
    createdAt: repo.now().toISOString(),
  };
  const nextState: GitStubState = {
    ...state,
    commits: {
      ...state.commits,
      [id]: commitEntry,
    },
    branches: {
      ...state.branches,
      [state.currentBranch]: { head: id },
    },
    index: {},
  };
  await writeState(repo, nextState);
  const fileCount = staged.length;
  return success(repo, `[${state.currentBranch} ${id}] ${message}\n ${fileCount} ${fileCount === 1 ? 'file' : 'files'} changed`);
}

async function checkout(
  repo: GitStubRepository,
  state: GitStubState,
  args: string[],
): Promise<GitStubCommandResult> {
  if (args[0] === '-b') {
    const branchName = args[1];
    if (!branchName) return failure(repo, 'fatal: git checkout -b requires a branch name', 1);
    if (state.branches[branchName]) return failure(repo, `fatal: a branch named "${branchName}" already exists`, 1);
    const nextState: GitStubState = {
      ...state,
      currentBranch: branchName,
      branches: {
        ...state.branches,
        [branchName]: { head: state.branches[state.currentBranch]?.head ?? null },
      },
    };
    await writeState(repo, nextState);
    return success(repo, `Switched to a new branch ${branchName}`);
  }

  const branchName = args[0];
  if (!branchName) return failure(repo, 'fatal: checkout requires a branch name', 1);
  if (!state.branches[branchName]) return failure(repo, `error: pathspec "${branchName}" did not match any branch`, 1);
  await writeState(repo, { ...state, currentBranch: branchName });
  return success(repo, `Switched to branch ${branchName}`);
}

async function formatStatus(repo: GitStubRepository, state: GitStubState, short: boolean): Promise<string> {
  const status = await getStatus(repo, state);
  if (short) {
    return formatShortStatus(status);
  }

  if (!status.staged.length && !status.unstaged.length && !status.untracked.length) {
    return `On branch ${state.currentBranch}\nnothing to commit, working tree clean`;
  }

  const sections = [`On branch ${state.currentBranch}`];
  if (status.staged.length) {
    sections.push(
      'Changes to be committed:',
      ...status.staged.map((entry) => `  ${entry.kind}: ${entry.path}`),
    );
  }
  if (status.unstaged.length) {
    if (sections.length > 1) sections.push('');
    sections.push(
      'Changes not staged for commit:',
      ...status.unstaged.map((entry) => `  ${entry.kind}: ${entry.path}`),
    );
  }
  if (status.untracked.length) {
    if (sections.length > 1) sections.push('');
    sections.push(
      'Untracked files:',
      ...status.untracked.map((path) => `  ${path}`),
    );
  }
  if (!status.staged.length) {
    sections.push('', 'nothing staged for commit');
  } else if (!status.unstaged.length && !status.untracked.length) {
    sections.push('', 'working tree clean');
  }
  return sections.join('\n');
}

function formatShortStatus(status: Awaited<ReturnType<typeof getStatus>>): string {
  const lines = [
    ...status.staged.map((entry) => `${formatShortStatusKind(entry.kind)}  ${entry.path}`),
    ...status.unstaged.map((entry) => ` ${formatShortStatusKind(entry.kind)} ${entry.path}`),
    ...status.untracked.map((path) => `?? ${path}`),
  ];
  return lines.join('\n') || 'clean';
}

function formatShortStatusKind(kind: StatusEntryKind): string {
  if (kind === 'added') return 'A';
  if (kind === 'deleted') return 'D';
  return 'M';
}

async function formatDiff(repo: GitStubRepository, state: GitStubState, cached: boolean): Promise<string> {
  const status = await getStatus(repo, state);
  const entries = cached ? status.staged : status.unstaged;
  return entries.map((entry) => `${entry.kind} ${entry.path}`).join('\n') || '';
}

function formatLog(state: GitStubState, oneline: boolean): string {
  const commits = getCurrentBranchCommits(state);
  if (!commits.length) return '';
  return commits.map((commitEntry) => oneline
    ? `${commitEntry.id} ${commitEntry.message}`
    : [
        `commit ${commitEntry.id}`,
        `Date: ${commitEntry.createdAt}`,
        '',
        `    ${commitEntry.message}`,
      ].join('\n')).join('\n');
}

function formatBranches(state: GitStubState): string {
  return Object.keys(state.branches)
    .map((branch) => `${branch === state.currentBranch ? '*' : ' '} ${branch}`)
    .join('\n');
}

async function getStatus(repo: GitStubRepository, state: GitStubState) {
  const workingFiles = await readWorkingFiles(repo);
  const headFiles = getHeadFiles(state);
  const staged = getStagedEntries(state);
  const stagedPathSet = new Set(staged.map((entry) => entry.path));
  const untracked: string[] = [];
  const unstaged: StatusEntry[] = [];

  for (const path of Object.keys(workingFiles).sort()) {
    if (!Object.prototype.hasOwnProperty.call(headFiles, path) && !Object.prototype.hasOwnProperty.call(state.index, path)) {
      untracked.push(path);
      continue;
    }
    const baseline = Object.prototype.hasOwnProperty.call(state.index, path) ? state.index[path] : headFiles[path];
    if (workingFiles[path] !== baseline) {
      unstaged.push({ path, kind: 'modified' });
    }
  }

  const trackedPaths = new Set([...Object.keys(headFiles), ...Object.keys(state.index)]);
  for (const path of [...trackedPaths].sort((left, right) => left.localeCompare(right))) {
    if (Object.prototype.hasOwnProperty.call(workingFiles, path)) {
      continue;
    }
    unstaged.push({ path, kind: 'deleted' });
  }

  return {
    staged,
    unstaged: unstaged.filter((entry) => !stagedPathSet.has(entry.path) || workingFiles[entry.path] !== state.index[entry.path]),
    untracked,
  };
}

function getStagedEntries(state: GitStubState): StatusEntry[] {
  const headFiles = getHeadFiles(state);
  return Object.keys(state.index)
    .sort()
    .filter((path) => state.index[path] !== headFiles[path])
    .map((path) => ({
      path,
      kind: Object.prototype.hasOwnProperty.call(headFiles, path) ? 'modified' : 'added',
    }));
}

function getHeadFiles(state: GitStubState): Record<string, string> {
  const headId = state.branches[state.currentBranch]?.head;
  if (!headId) return {};
  return state.commits[headId]?.files ?? {};
}

function getCurrentBranchCommits(state: GitStubState): GitStubCommit[] {
  const commits: GitStubCommit[] = [];
  let cursor = state.branches[state.currentBranch]?.head ?? null;
  while (cursor) {
    const commitEntry = state.commits[cursor];
    if (!commitEntry) break;
    commits.push(commitEntry);
    cursor = commitEntry.parentIds[0] ?? null;
  }
  return commits;
}

async function readWorkingFiles(repo: GitStubRepository): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const paths = repo.fs.getAllPaths().sort((left, right) => left.localeCompare(right));
  for (const path of paths) {
    const relativePath = toRepoRelativePath(repo, path);
    if (!relativePath || relativePath === '.keep' || relativePath.startsWith(`${STATE_DIR}/`)) {
      continue;
    }
    try {
      const content = await repo.fs.readFile(path, 'utf-8');
      files[relativePath] = typeof content === 'string' ? content : new TextDecoder().decode(content);
    } catch {
      // just-bash exposes folders in getAllPaths(); unreadable entries are not files.
    }
  }
  return files;
}

function expandPathspecs(
  repo: GitStubRepository,
  workingFiles: Record<string, string>,
  rawPaths: string[],
): string[] {
  const selected = new Set<string>();
  for (const rawPath of rawPaths) {
    const pathspec = normalizePathspec(repo, rawPath);
    if (pathspec === '.') {
      for (const path of Object.keys(workingFiles)) {
        selected.add(path);
      }
      continue;
    }
    for (const path of Object.keys(workingFiles)) {
      if (path === pathspec || path.startsWith(`${pathspec}/`)) {
        selected.add(path);
      }
    }
  }
  return [...selected].sort((left, right) => left.localeCompare(right));
}

function parseCommitMessage(args: string[]): string | null {
  const messageFlagIndex = args.findIndex((arg) => arg === '-m' || arg === '--message');
  if (messageFlagIndex >= 0) {
    return args[messageFlagIndex + 1]?.trim() || null;
  }
  const inlineMessage = args.find((arg) => arg.startsWith('-m') && arg.length > 2);
  return inlineMessage?.slice(2).trim() || null;
}

async function readState(repo: GitStubRepository): Promise<GitStubState | null> {
  try {
    const raw = await repo.fs.readFile(stateFilePath(repo), 'utf-8');
    const parsed = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    return isGitStubState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeState(repo: GitStubRepository, state: GitStubState): Promise<void> {
  await repo.fs.mkdir?.(stateDirPath(repo), { recursive: true });
  await repo.fs.writeFile(stateFilePath(repo), JSON.stringify(state, null, 2), 'utf-8');
}

function isGitStubState(value: unknown): value is GitStubState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Partial<GitStubState>;
  return state.version === 1
    && typeof state.rootPath === 'string'
    && typeof state.currentBranch === 'string'
    && isRecord(state.branches)
    && isRecord(state.commits)
    && isStringRecord(state.index)
    && typeof state.initializedAt === 'string';
}

function createCommitId(
  state: GitStubState,
  branch: string,
  message: string,
  files: Record<string, string>,
): string {
  if (!Object.keys(state.commits).length) {
    return '6a4cac3';
  }
  const source = JSON.stringify({
    branch,
    message,
    files,
    parent: state.branches[branch]?.head ?? null,
    count: Object.keys(state.commits).length,
  });
  return hashString(source).slice(0, 7);
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

function normalizePathspec(repo: GitStubRepository, rawPath: string): string {
  const normalized = rawPath.replaceAll('\\', '/').replace(/\/+/g, '/');
  if (normalized === '.') return '.';
  if (normalized.startsWith(`${repo.rootPath}/`)) {
    return normalized.slice(repo.rootPath.length + 1);
  }
  if (normalized.startsWith('/')) {
    return normalized.replace(/^\/+/, '');
  }
  const cwdRelative = toRepoRelativePath(repo, repo.cwd);
  return cwdRelative ? `${cwdRelative}/${normalized}` : normalized;
}

function toRepoRelativePath(repo: GitStubRepository, path: string): string | null {
  const normalized = normalizeAbsolutePath(path);
  if (normalized === repo.rootPath) return '';
  if (!normalized.startsWith(`${repo.rootPath}/`)) return null;
  return normalized.slice(repo.rootPath.length + 1);
}

function stateDirPath(repo: GitStubRepository): string {
  return `${repo.rootPath}/${STATE_DIR}`;
}

function stateFilePath(repo: GitStubRepository): string {
  return `${stateDirPath(repo)}/${STATE_FILE}`;
}

function normalizeAbsolutePath(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/\/+/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function success(repo: GitStubRepository, stdout: string): GitStubCommandResult {
  return {
    stdout,
    stderr: '',
    exitCode: 0,
    cwd: repo.cwd,
  };
}

function failure(repo: GitStubRepository, stderr: string, exitCode: number): GitStubCommandResult {
  return {
    stdout: '',
    stderr,
    exitCode,
    cwd: repo.cwd,
  };
}
