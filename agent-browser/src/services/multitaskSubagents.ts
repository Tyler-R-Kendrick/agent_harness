export type MultitaskSubagentStatus = 'queued' | 'running' | 'blocked' | 'ready' | 'promoted';

export interface MultitaskSubagentBranch {
  id: string;
  title: string;
  role: string;
  branchName: string;
  worktreePath: string;
  status: MultitaskSubagentStatus;
  progress: number;
  changedFiles: string[];
  summary: string;
  validation: string[];
  confidence: number;
}

export interface MultitaskSubagentState {
  enabled: boolean;
  request: string;
  workspaceId: string;
  workspaceName: string;
  createdAt: string;
  foregroundBranchId: string | null;
  branches: MultitaskSubagentBranch[];
}

export interface MultitaskSubagentSummary {
  total: number;
  queued: number;
  running: number;
  ready: number;
  blocked: number;
  changedFiles: number;
  promotedBranch: MultitaskSubagentBranch | null;
}

export interface CreateMultitaskSubagentStateInput {
  workspaceId: string;
  workspaceName: string;
  request: string;
  hints?: string[];
  now?: Date;
}

type TrackDefinition = {
  slug: string;
  title: string;
  role: string;
  files: string[];
};

export const DEFAULT_MULTITASK_SUBAGENT_STATE: MultitaskSubagentState = {
  enabled: false,
  request: '',
  workspaceId: '',
  workspaceName: '',
  createdAt: '',
  foregroundBranchId: null,
  branches: [],
};

const TRACK_DEFINITIONS: TrackDefinition[] = [
  {
    slug: 'api',
    title: 'API branch',
    role: 'API specialist',
    files: ['agent-browser/server/api.ts', 'agent-browser/src/services/apiClient.ts'],
  },
  {
    slug: 'frontend',
    title: 'Frontend branch',
    role: 'Frontend specialist',
    files: ['agent-browser/src/App.tsx', 'agent-browser/src/App.css'],
  },
  {
    slug: 'ui',
    title: 'UI branch',
    role: 'UI specialist',
    files: ['agent-browser/src/App.tsx', 'agent-browser/src/features/worktree/GitWorktreePanel.tsx'],
  },
  {
    slug: 'tests',
    title: 'Tests branch',
    role: 'Test specialist',
    files: ['agent-browser/src/App.smoke.test.tsx', 'agent-browser/src/services/multitaskSubagents.test.ts'],
  },
  {
    slug: 'documentation',
    title: 'Documentation branch',
    role: 'Documentation specialist',
    files: ['docs/superpowers/plans/multitask-subagents.md', 'agent-browser/README.md'],
  },
  {
    slug: 'release-notes',
    title: 'Release notes branch',
    role: 'Release specialist',
    files: ['docs/release-notes.md'],
  },
  {
    slug: 'app-shell',
    title: 'App shell branch',
    role: 'Shell specialist',
    files: ['agent-browser/src/App.tsx', 'agent-browser/src/services/sessionState.ts'],
  },
];

const FALLBACK_TRACKS: TrackDefinition[] = [
  TRACK_DEFINITIONS[1],
  TRACK_DEFINITIONS[3],
  TRACK_DEFINITIONS[4],
];

const STATUS_VALUES: MultitaskSubagentStatus[] = ['queued', 'running', 'blocked', 'ready', 'promoted'];

export function createMultitaskSubagentState({
  workspaceId,
  workspaceName,
  request,
  hints = [],
  now = new Date(),
}: CreateMultitaskSubagentStateInput): MultitaskSubagentState {
  const workspaceSlug = slugify(workspaceName || workspaceId || 'workspace');
  const tracks = selectTracks([request, ...hints].join(' '));
  const createdAt = Number.isNaN(now.getTime()) ? new Date(0).toISOString() : now.toISOString();
  const branches = tracks.map((track, index): MultitaskSubagentBranch => {
    const ordinal = index + 1;
    const branchName = `agent/${workspaceSlug}/${track.slug}-${ordinal}`;
    return {
      id: `multitask:${workspaceId}:${track.slug}-${ordinal}`,
      title: track.title,
      role: track.role,
      branchName,
      worktreePath: `.worktrees/${branchName}`,
      status: index === 0 ? 'running' : 'queued',
      progress: index === 0 ? 35 : 0,
      changedFiles: [...track.files],
      summary: `${track.role} owns the ${track.slug.replace(/-/g, ' ')} slice in an isolated branch.`,
      validation: [
        `Compare ${track.slug.replace(/-/g, ' ')} output before promotion.`,
        `Keep changes scoped to ${branchName}.`,
      ],
      confidence: Math.max(0.55, 0.86 - index * 0.08),
    };
  });

  return {
    enabled: true,
    request: request.trim(),
    workspaceId,
    workspaceName,
    createdAt,
    foregroundBranchId: null,
    branches,
  };
}

export function summarizeMultitaskSubagents(state: MultitaskSubagentState): MultitaskSubagentSummary {
  const countByStatus = (status: MultitaskSubagentStatus) =>
    state.branches.filter((branch) => branch.status === status).length;
  return {
    total: state.branches.length,
    queued: countByStatus('queued'),
    running: countByStatus('running'),
    ready: countByStatus('ready'),
    blocked: countByStatus('blocked'),
    changedFiles: state.branches.reduce((total, branch) => total + branch.changedFiles.length, 0),
    promotedBranch: state.branches.find((branch) => branch.id === state.foregroundBranchId) ?? null,
  };
}

export function promoteMultitaskBranch(
  state: MultitaskSubagentState,
  branchId: string,
): MultitaskSubagentState {
  if (!state.branches.some((branch) => branch.id === branchId)) return state;
  return {
    ...state,
    foregroundBranchId: branchId,
    branches: state.branches.map((branch) => {
      if (branch.id === branchId) {
        return { ...branch, status: 'promoted', progress: 100 };
      }
      return {
        ...branch,
        status: branch.status === 'blocked' ? branch.status : 'ready',
        progress: branch.status === 'blocked' ? branch.progress : Math.max(branch.progress, 100),
      };
    }),
  };
}

export function buildMultitaskPromptContext(state: MultitaskSubagentState): string {
  if (!state.enabled || state.branches.length === 0) return '';
  const promoted = state.branches.find((branch) => branch.id === state.foregroundBranchId) ?? null;
  return [
    '## Multitask Subagents',
    'Branch isolation: enabled',
    `Request: ${state.request || 'unspecified'}`,
    `Workspace: ${state.workspaceName || state.workspaceId || 'workspace'}`,
    `Foreground branch: ${promoted?.branchName ?? 'none selected'}`,
    'Branches:',
    ...state.branches.map((branch) => [
      `- ${branch.title}: ${branch.branchName}`,
      `  Worktree: ${branch.worktreePath}`,
      `  Status: ${branch.status}; confidence: ${Math.round(branch.confidence * 100)}%; changed files: ${branch.changedFiles.length}`,
      `  Validation: ${branch.validation.join(' | ')}`,
    ].join('\n')),
  ].join('\n');
}

export function isMultitaskSubagentState(value: unknown): value is MultitaskSubagentState {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && typeof value.request === 'string'
    && typeof value.workspaceId === 'string'
    && typeof value.workspaceName === 'string'
    && typeof value.createdAt === 'string'
    && (value.foregroundBranchId === null || typeof value.foregroundBranchId === 'string')
    && Array.isArray(value.branches)
    && value.branches.every(isMultitaskSubagentBranch)
  );
}

function isMultitaskSubagentBranch(value: unknown): value is MultitaskSubagentBranch {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.role === 'string'
    && typeof value.branchName === 'string'
    && typeof value.worktreePath === 'string'
    && typeof value.status === 'string'
    && (STATUS_VALUES as string[]).includes(value.status)
    && typeof value.progress === 'number'
    && typeof value.confidence === 'number'
    && Array.isArray(value.changedFiles)
    && value.changedFiles.every((entry) => typeof entry === 'string')
    && typeof value.summary === 'string'
    && Array.isArray(value.validation)
    && value.validation.every((entry) => typeof entry === 'string')
  );
}

function selectTracks(text: string): TrackDefinition[] {
  const lowered = text.toLowerCase();
  const selected = TRACK_DEFINITIONS.filter((track) => {
    const words = track.slug.split('-');
    return words.every((word) => lowered.includes(word));
  });
  const tracks = selected.length > 0 ? selected : FALLBACK_TRACKS;
  return tracks.slice(0, 4);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'workspace';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
