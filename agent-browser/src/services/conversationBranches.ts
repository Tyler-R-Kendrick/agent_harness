import type { ProcessEntry } from './processLog';

export type ConversationSubthreadStatus = 'running' | 'blocked' | 'merged';

export interface ConversationBranchSettings {
  enabled: boolean;
  includeBranchContext: boolean;
  showProcessGraphNodes: boolean;
  autoSummarizeOnMerge: boolean;
}

export interface ConversationBranchCommit {
  id: string;
  branchId: string;
  parentIds: string[];
  sourceSessionId: string;
  messageIds: string[];
  summary: string;
  createdAt: string;
  mergedIntoMainAt?: string;
}

export interface ConversationSubthread {
  id: string;
  title: string;
  branchName: string;
  status: ConversationSubthreadStatus;
  createdAt: string;
  updatedAt: string;
  headCommitId: string;
  lastMergedCommitId: string | null;
  summary: string;
}

export interface ConversationBranchingState {
  enabled: boolean;
  workspaceId: string;
  workspaceName: string;
  mainSessionId: string;
  mainBranchId: 'main';
  mainHeadCommitId: string;
  createdAt: string;
  updatedAt: string;
  settings: ConversationBranchSettings;
  subthreads: ConversationSubthread[];
  commits: Record<string, ConversationBranchCommit>;
}

export interface ConversationBranchSummary {
  totalSubthreads: number;
  activeSubthreads: number;
  mergedSubthreads: number;
  commitCount: number;
  latestSummary: string;
}

export interface CreateConversationBranchingStateInput {
  workspaceId: string;
  workspaceName: string;
  mainSessionId: string;
  request: string;
  now?: Date;
}

export interface CommitConversationSubthreadInput {
  sourceSessionId: string;
  messageIds?: string[];
  summary: string;
  now?: Date;
}

export interface MergeConversationSubthreadInput {
  summary: string;
  now?: Date;
}

export const DEFAULT_CONVERSATION_BRANCH_SETTINGS: ConversationBranchSettings = {
  enabled: true,
  includeBranchContext: true,
  showProcessGraphNodes: true,
  autoSummarizeOnMerge: true,
};

export const DEFAULT_CONVERSATION_BRANCHING_STATE: ConversationBranchingState = {
  enabled: false,
  workspaceId: '',
  workspaceName: '',
  mainSessionId: '',
  mainBranchId: 'main',
  mainHeadCommitId: '',
  createdAt: '',
  updatedAt: '',
  settings: DEFAULT_CONVERSATION_BRANCH_SETTINGS,
  subthreads: [],
  commits: {},
};

export function createConversationBranchingState({
  workspaceId,
  workspaceName,
  mainSessionId,
  request,
  now = new Date(),
}: CreateConversationBranchingStateInput): ConversationBranchingState {
  const createdAt = normalizeDate(now);
  const title = normalizeTitle(request);
  const workspaceSlug = slugify(workspaceName || workspaceId || 'workspace');
  const requestSlug = slugify(title);
  const subthreadId = `subthread:${workspaceId}:${requestSlug}`;
  const mainCommitId = buildCommitId('main', workspaceId, createdAt);
  const branchCommitId = buildCommitId(`subthread-${workspaceId}-${requestSlug}`, workspaceId, createdAt);
  const mainCommit: ConversationBranchCommit = {
    id: mainCommitId,
    branchId: 'main',
    parentIds: [],
    sourceSessionId: mainSessionId,
    messageIds: [],
    summary: `Main thread before branch: ${title}`,
    createdAt,
  };
  const branchCommit: ConversationBranchCommit = {
    id: branchCommitId,
    branchId: subthreadId,
    parentIds: [mainCommitId],
    sourceSessionId: mainSessionId,
    messageIds: [],
    summary: `Branch started: ${title}`,
    createdAt,
  };
  return {
    enabled: true,
    workspaceId,
    workspaceName,
    mainSessionId,
    mainBranchId: 'main',
    mainHeadCommitId: mainCommitId,
    createdAt,
    updatedAt: createdAt,
    settings: DEFAULT_CONVERSATION_BRANCH_SETTINGS,
    subthreads: [{
      id: subthreadId,
      title,
      branchName: `conversation/${workspaceSlug}/${requestSlug}`,
      status: 'running',
      createdAt,
      updatedAt: createdAt,
      headCommitId: branchCommitId,
      lastMergedCommitId: null,
      summary: branchCommit.summary,
    }],
    commits: {
      [mainCommitId]: mainCommit,
      [branchCommitId]: branchCommit,
    },
  };
}

export function commitConversationSubthread(
  state: ConversationBranchingState,
  subthreadId: string,
  input: CommitConversationSubthreadInput,
): ConversationBranchingState {
  const subthread = state.subthreads.find((candidate) => candidate.id === subthreadId);
  if (!subthread) return state;
  const createdAt = normalizeDate(input.now ?? new Date());
  const commitId = buildCommitId(subthread.id.replace(/[^a-zA-Z0-9]+/g, '-'), state.workspaceId, createdAt);
  const commit: ConversationBranchCommit = {
    id: commitId,
    branchId: subthread.id,
    parentIds: [subthread.headCommitId],
    sourceSessionId: input.sourceSessionId,
    messageIds: input.messageIds ?? [],
    summary: input.summary,
    createdAt,
  };
  return {
    ...state,
    updatedAt: createdAt,
    subthreads: state.subthreads.map((candidate) => candidate.id === subthread.id
      ? {
          ...candidate,
          status: candidate.status === 'blocked' ? candidate.status : 'running',
          updatedAt: createdAt,
          headCommitId: commitId,
          summary: input.summary,
        }
      : candidate),
    commits: {
      ...state.commits,
      [commitId]: commit,
    },
  };
}

export function mergeConversationSubthread(
  state: ConversationBranchingState,
  subthreadId: string,
  input: MergeConversationSubthreadInput,
): ConversationBranchingState {
  const subthread = state.subthreads.find((candidate) => candidate.id === subthreadId);
  if (!subthread) return state;
  const createdAt = normalizeDate(input.now ?? new Date());
  const mergeCommitId = buildCommitId(`merge-${subthread.id.replace(/[^a-zA-Z0-9]+/g, '-')}`, state.workspaceId, createdAt);
  const mergeCommit: ConversationBranchCommit = {
    id: mergeCommitId,
    branchId: 'main',
    parentIds: [state.mainHeadCommitId, subthread.headCommitId].filter(Boolean),
    sourceSessionId: state.mainSessionId,
    messageIds: [],
    summary: input.summary,
    createdAt,
  };
  const branchHead = state.commits[subthread.headCommitId];
  return {
    ...state,
    mainHeadCommitId: mergeCommitId,
    updatedAt: createdAt,
    subthreads: state.subthreads.map((candidate) => candidate.id === subthread.id
      ? {
          ...candidate,
          status: 'merged',
          updatedAt: createdAt,
          lastMergedCommitId: subthread.headCommitId,
        }
      : candidate),
    commits: {
      ...state.commits,
      ...(branchHead ? {
        [branchHead.id]: {
          ...branchHead,
          mergedIntoMainAt: createdAt,
        },
      } : {}),
      [mergeCommitId]: mergeCommit,
    },
  };
}

export function summarizeConversationBranches(state: ConversationBranchingState): ConversationBranchSummary {
  const latestSubthread = [...state.subthreads].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
  return {
    totalSubthreads: state.subthreads.length,
    activeSubthreads: state.subthreads.filter((subthread) => subthread.status === 'running').length,
    mergedSubthreads: state.subthreads.filter((subthread) => subthread.status === 'merged').length,
    commitCount: Object.keys(state.commits).length,
    latestSummary: latestSubthread?.summary ?? 'No conversation branches yet',
  };
}

export function buildConversationBranchPromptContext(state: ConversationBranchingState): string {
  if (!state.enabled || !state.settings.enabled || !state.settings.includeBranchContext || state.subthreads.length === 0) {
    return '';
  }
  return [
    '## Conversation Branches',
    `Main session: ${state.mainSessionId || 'unknown'}`,
    `Main head commit: ${state.mainHeadCommitId || 'none'}`,
    'Subthreads:',
    ...state.subthreads.map((subthread) => [
      `- ${subthread.branchName}`,
      `  ID: ${subthread.id}`,
      `  Status: ${subthread.status}`,
      `  Head commit: ${subthread.headCommitId}`,
      `  Last merged commit: ${subthread.lastMergedCommitId ?? 'not merged'}`,
      `  Latest summary: ${subthread.summary}`,
    ].join('\n')),
  ].join('\n');
}

export function buildConversationBranchProcessEntries(state: ConversationBranchingState): ProcessEntry[] {
  if (!state.settings.showProcessGraphNodes) return [];
  return Object.values(state.commits)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
    .map((commit, position): ProcessEntry => ({
      id: `conversation-branch:${commit.id}`,
      position,
      ts: Date.parse(commit.createdAt),
      kind: 'commit',
      actor: 'conversation-branch',
      summary: commit.summary,
      payload: commit,
      parentId: commit.parentIds.at(-1) ? `conversation-branch:${commit.parentIds.at(-1)}` : undefined,
      branchId: commit.branchId,
      status: 'done',
      endedAt: Date.parse(commit.mergedIntoMainAt ?? commit.createdAt),
    }));
}

export function isConversationBranchingRequest(text: string): boolean {
  const lowered = text.toLowerCase();
  return /(branch|subthread|sub-thread|fork)/.test(lowered)
    && /(conversation|chat|thread|this|main)/.test(lowered);
}

export function isConversationBranchingState(value: unknown): value is ConversationBranchingState {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && typeof value.workspaceId === 'string'
    && typeof value.workspaceName === 'string'
    && typeof value.mainSessionId === 'string'
    && value.mainBranchId === 'main'
    && typeof value.mainHeadCommitId === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string'
    && isConversationBranchSettings(value.settings)
    && Array.isArray(value.subthreads)
    && value.subthreads.every(isConversationSubthread)
    && isRecord(value.commits)
    && Object.values(value.commits).every(isConversationBranchCommit)
  );
}

function isConversationBranchSettings(value: unknown): value is ConversationBranchSettings {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && typeof value.includeBranchContext === 'boolean'
    && typeof value.showProcessGraphNodes === 'boolean'
    && typeof value.autoSummarizeOnMerge === 'boolean'
  );
}

function isConversationSubthread(value: unknown): value is ConversationSubthread {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.branchName === 'string'
    && typeof value.status === 'string'
    && (['running', 'blocked', 'merged'] as string[]).includes(value.status)
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string'
    && typeof value.headCommitId === 'string'
    && (value.lastMergedCommitId === null || typeof value.lastMergedCommitId === 'string')
    && typeof value.summary === 'string'
  );
}

function isConversationBranchCommit(value: unknown): value is ConversationBranchCommit {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.branchId === 'string'
    && Array.isArray(value.parentIds)
    && value.parentIds.every((entry) => typeof entry === 'string')
    && typeof value.sourceSessionId === 'string'
    && Array.isArray(value.messageIds)
    && value.messageIds.every((entry) => typeof entry === 'string')
    && typeof value.summary === 'string'
    && typeof value.createdAt === 'string'
    && (value.mergedIntoMainAt === undefined || typeof value.mergedIntoMainAt === 'string')
  );
}

function normalizeDate(date: Date): string {
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function normalizeTitle(request: string): string {
  const trimmed = request.trim().replace(/\s+/g, ' ');
  return trimmed || 'Branch active chat thread';
}

function buildCommitId(prefix: string, workspaceId: string, createdAt: string): string {
  return `${slugify(prefix)}:${workspaceId}:${createdAt.replace(/[^0-9TZ]+/g, '-')}`;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'branch';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
