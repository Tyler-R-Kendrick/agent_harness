import type { WorkGraphActor, WorkGraphCommand } from '@agent-harness/workgraph';

export type MultitaskSubagentStatus = 'queued' | 'running' | 'stopped' | 'blocked' | 'ready' | 'promoted' | 'cancelled';
export type MultitaskApprovalActor = 'user' | 'reviewer-agent';
export type MultitaskBranchLifecycleAction = 'start' | 'stop' | 'retry' | 'dispose';

export interface MultitaskSubagentBranch {
  id: string;
  title: string;
  role: string;
  projectId: string | null;
  branchName: string;
  worktreePath: string;
  status: MultitaskSubagentStatus;
  progress: number;
  changedFiles: string[];
  summary: string;
  validation: string[];
  confidence: number;
}

export interface MultitaskProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface MultitaskSubagentState {
  enabled: boolean;
  request: string;
  workspaceId: string;
  workspaceName: string;
  createdAt: string;
  foregroundBranchId: string | null;
  foregroundBranchApprovedBy: MultitaskApprovalActor | null;
  activeProjectId: string | null;
  selectedBranchId: string | null;
  projects: MultitaskProject[];
  branches: MultitaskSubagentBranch[];
}

export interface MultitaskSubagentSummary {
  total: number;
  queued: number;
  running: number;
  stopped: number;
  ready: number;
  blocked: number;
  cancelled: number;
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

export interface BuildMultitaskWorkGraphCommandsOptions {
  actor?: WorkGraphActor;
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
  foregroundBranchApprovedBy: null,
  activeProjectId: null,
  selectedBranchId: null,
  projects: [],
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

const STATUS_VALUES: MultitaskSubagentStatus[] = ['queued', 'running', 'stopped', 'blocked', 'ready', 'promoted', 'cancelled'];

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
  const project: MultitaskProject = {
    id: projectIdFor(workspaceId, 'symphony'),
    name: workspaceName || workspaceId || 'Symphony',
    description: request.trim(),
    createdAt,
  };
  const branches = tracks.map((track, index): MultitaskSubagentBranch => {
    const ordinal = index + 1;
    const branchName = `agent/${workspaceSlug}/${track.slug}-${ordinal}`;
    return {
      id: `multitask:${workspaceId}:${track.slug}-${ordinal}`,
      title: track.title,
      role: track.role,
      projectId: project.id,
      branchName,
      worktreePath: `.worktrees/${branchName}`,
      status: 'queued',
      progress: 0,
      changedFiles: [...track.files],
      summary: `${track.role} owns the ${track.slug.replace(/-/g, ' ')} slice in an isolated branch.`,
      validation: [
        `Review ${track.slug.replace(/-/g, ' ')} evidence before merge approval.`,
        `Merge only from ${branchName}.`,
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
    foregroundBranchApprovedBy: null,
    activeProjectId: project.id,
    selectedBranchId: branches[0]?.id ?? null,
    projects: [project],
    branches,
  };
}

export function createMultitaskProject(
  state: MultitaskSubagentState,
  name: string,
  now = new Date(),
): MultitaskSubagentState {
  const projectName = name.trim();
  if (!projectName) return state;
  const createdAt = Number.isNaN(now.getTime()) ? new Date(0).toISOString() : now.toISOString();
  const projects = projectsForState(state);
  const project: MultitaskProject = {
    id: uniqueProjectId(state.workspaceId, projectName, projects),
    name: projectName,
    description: '',
    createdAt,
  };
  return {
    ...state,
    enabled: true,
    request: state.request || projectName,
    createdAt: state.createdAt || createdAt,
    activeProjectId: project.id,
    selectedBranchId: state.selectedBranchId ?? state.branches[0]?.id ?? null,
    projects: [...projects, project],
  };
}

export interface AddMultitaskTaskInput {
  title: string;
  projectId?: string | null;
  now?: Date;
}

export function addMultitaskTask(
  state: MultitaskSubagentState,
  input: AddMultitaskTaskInput,
): MultitaskSubagentState {
  const title = input.title.trim();
  if (!title) return state;
  const now = input.now ?? new Date();
  const createdAt = Number.isNaN(now.getTime()) ? new Date(0).toISOString() : now.toISOString();
  let projects = projectsForState(state);
  if (projects.length === 0) {
    projects = [{
      id: projectIdFor(state.workspaceId, 'symphony'),
      name: state.workspaceName || state.workspaceId || 'Symphony',
      description: state.request,
      createdAt,
    }];
  }
  const project = projects.find((candidate) => candidate.id === input.projectId)
    ?? projects.find((candidate) => candidate.id === state.activeProjectId)
    ?? projects[0];
  const ordinal = state.branches.length + 1;
  const taskSlug = slugify(title);
  const workspaceSlug = slugify(state.workspaceName || state.workspaceId || 'workspace');
  const branchName = `agent/${workspaceSlug}/${taskSlug}-${ordinal}`;
  const branch: MultitaskSubagentBranch = {
    id: `multitask:${state.workspaceId}:${taskSlug}-${ordinal}`,
    title,
    role: 'Agent task',
    projectId: project.id,
    branchName,
    worktreePath: `.worktrees/${branchName}`,
    status: 'queued',
    progress: 0,
    changedFiles: [],
    summary: `Agent task for ${title} in an isolated branch.`,
    validation: [
      `Review task evidence before merge approval.`,
      `Merge only from ${branchName}.`,
    ],
    confidence: 0.72,
  };
  return {
    ...state,
    enabled: true,
    request: state.request || title,
    createdAt: state.createdAt || createdAt,
    activeProjectId: project.id,
    selectedBranchId: branch.id,
    projects,
    branches: [...state.branches, branch],
  };
}

export function selectMultitaskProject(state: MultitaskSubagentState, projectId: string): MultitaskSubagentState {
  const projects = projectsForState(state);
  if (!projects.some((project) => project.id === projectId)) return state;
  const firstBranch = state.branches.find((branch) => branch.projectId === projectId) ?? null;
  return {
    ...state,
    activeProjectId: projectId,
    selectedBranchId: firstBranch?.id ?? state.selectedBranchId,
    projects,
  };
}

export function selectMultitaskTask(state: MultitaskSubagentState, branchId: string): MultitaskSubagentState {
  const branch = state.branches.find((candidate) => candidate.id === branchId);
  if (!branch) return state;
  return {
    ...state,
    selectedBranchId: branchId,
    activeProjectId: branch.projectId ?? state.activeProjectId,
    projects: projectsForState(state),
  };
}

export function summarizeMultitaskSubagents(state: MultitaskSubagentState): MultitaskSubagentSummary {
  const countByStatus = (status: MultitaskSubagentStatus) =>
    state.branches.filter((branch) => branch.status === status).length;
  return {
    total: state.branches.length,
    queued: countByStatus('queued'),
    running: countByStatus('running'),
    stopped: countByStatus('stopped'),
    ready: countByStatus('ready'),
    blocked: countByStatus('blocked'),
    cancelled: countByStatus('cancelled'),
    changedFiles: state.branches.reduce((total, branch) => total + branch.changedFiles.length, 0),
    promotedBranch: state.branches.find((branch) => branch.id === state.foregroundBranchId) ?? null,
  };
}

export function promoteMultitaskBranch(
  state: MultitaskSubagentState,
  branchId: string,
  actor: MultitaskApprovalActor = 'user',
): MultitaskSubagentState {
  if (!state.branches.some((branch) => branch.id === branchId)) return state;
  return {
    ...state,
    foregroundBranchId: branchId,
    foregroundBranchApprovedBy: actor,
    branches: state.branches.map((branch) => {
      if (branch.id === branchId) {
        return { ...branch, status: 'promoted', progress: 100 };
      }
      if (branch.status === 'blocked' || branch.status === 'stopped' || branch.status === 'cancelled') {
        return branch;
      }
      return {
        ...branch,
        status: 'ready',
        progress: Math.max(branch.progress, 100),
      };
    }),
  };
}

export function startMultitaskBranchRun(
  state: MultitaskSubagentState,
  branchId: string,
): MultitaskSubagentState {
  const branch = state.branches.find((candidate) => candidate.id === branchId);
  if (!branch || !['queued', 'stopped'].includes(branch.status)) return state;
  return updateBranch(state, branchId, (current) => ({
    ...current,
    status: 'running',
    progress: Math.max(current.progress, 10),
    validation: appendValidation(current.validation, `Session started in ${current.worktreePath}.`),
  }));
}

export function stopMultitaskBranchRun(
  state: MultitaskSubagentState,
  branchId: string,
): MultitaskSubagentState {
  const branch = state.branches.find((candidate) => candidate.id === branchId);
  if (!branch || branch.status !== 'running') return state;
  return updateBranch(state, branchId, (current) => ({
    ...current,
    status: 'stopped',
    validation: appendValidation(current.validation, 'Session stopped; workspace resources are preserved for resume.'),
  }));
}

export function retryMultitaskBranch(
  state: MultitaskSubagentState,
  branchId: string,
): MultitaskSubagentState {
  const branch = state.branches.find((candidate) => candidate.id === branchId);
  if (!branch || !['blocked', 'stopped', 'cancelled'].includes(branch.status)) return state;
  return {
    ...state,
    foregroundBranchId: state.foregroundBranchId === branchId ? null : state.foregroundBranchId,
    foregroundBranchApprovedBy: state.foregroundBranchId === branchId ? null : state.foregroundBranchApprovedBy,
    branches: state.branches.map((current) => current.id === branchId
      ? {
          ...current,
          status: 'queued',
          progress: 0,
          validation: appendValidation(current.validation, 'Retry queued for the isolated workspace.'),
        }
      : current),
  };
}

export function cancelMultitaskBranch(
  state: MultitaskSubagentState,
  branchId: string,
): MultitaskSubagentState {
  const branch = state.branches.find((candidate) => candidate.id === branchId);
  if (!branch || branch.status === 'cancelled') return state;
  return {
    ...state,
    foregroundBranchId: state.foregroundBranchId === branchId ? null : state.foregroundBranchId,
    foregroundBranchApprovedBy: state.foregroundBranchId === branchId ? null : state.foregroundBranchApprovedBy,
    branches: state.branches.map((current) => current.id === branchId
      ? {
          ...current,
          status: 'cancelled',
          validation: appendValidation(current.validation, 'Task cancelled; dispose the workspace when artifacts are no longer needed.'),
        }
      : current),
  };
}

export function disposeMultitaskBranch(
  state: MultitaskSubagentState,
  branchId: string,
): MultitaskSubagentState {
  if (!state.branches.some((branch) => branch.id === branchId)) return state;
  const branches = state.branches.filter((branch) => branch.id !== branchId);
  if (branches.length === 0) {
    return {
      ...DEFAULT_MULTITASK_SUBAGENT_STATE,
      workspaceId: state.workspaceId,
      workspaceName: state.workspaceName,
    };
  }
  return {
    ...state,
    foregroundBranchId: state.foregroundBranchId === branchId ? null : state.foregroundBranchId,
    foregroundBranchApprovedBy: state.foregroundBranchId === branchId ? null : state.foregroundBranchApprovedBy,
    selectedBranchId: state.selectedBranchId === branchId ? branches[0]?.id ?? null : state.selectedBranchId,
    branches,
  };
}

export function reduceMultitaskBranchLifecycle(
  state: MultitaskSubagentState,
  branchId: string,
  action: MultitaskBranchLifecycleAction,
): MultitaskSubagentState {
  if (action === 'start') return startMultitaskBranchRun(state, branchId);
  if (action === 'stop') return stopMultitaskBranchRun(state, branchId);
  if (action === 'retry') return retryMultitaskBranch(state, branchId);
  return disposeMultitaskBranch(state, branchId);
}

export function buildMultitaskWorkGraphCommands(
  state: MultitaskSubagentState,
  options: BuildMultitaskWorkGraphCommandsOptions = {},
): WorkGraphCommand[] {
  if (!state.enabled || state.branches.length === 0) return [];
  const actor = options.actor ?? { type: 'system' as const, id: 'symphony', name: 'Symphony' };
  const projects = projectsForState(state);
  const defaultProject = projects[0] ?? null;
  const workspaceId = `workgraph:workspace:${state.workspaceId || 'workspace'}`;
  const teamId = `workgraph:team:${state.workspaceId || 'workspace'}:symphony`;
  const labelId = `workgraph:label:${state.workspaceId || 'workspace'}:symphony`;
  const baseCommands: WorkGraphCommand[] = [
    {
      type: 'workspace.create',
      actor,
      payload: {
        id: workspaceId,
        name: state.workspaceName || state.workspaceId || 'Workspace',
        key: workGraphKey(state.workspaceName || state.workspaceId || 'Workspace'),
      },
    },
    {
      type: 'team.create',
      actor,
      payload: {
        id: teamId,
        workspaceId,
        name: 'Symphony',
        key: 'SYM',
        workflowStatuses: ['Backlog', 'In Progress', 'Paused', 'Blocked', 'In Review', 'Done', 'Closed'],
      },
    },
    ...projects.map((project): WorkGraphCommand => ({
      type: 'project.create',
      actor,
      payload: {
        id: workGraphProjectId(project.id),
        workspaceId,
        name: project.name,
      },
    })),
    {
      type: 'label.create',
      actor,
      payload: {
        id: labelId,
        workspaceId,
        name: 'symphony',
        color: '#60a5fa',
      },
    },
  ];

  return [
    ...baseCommands,
    ...state.branches.map((branch): WorkGraphCommand => ({
      type: 'issue.create',
      actor,
      payload: {
        id: branch.id,
        workspaceId,
        teamId,
        projectId: workGraphProjectId(branch.projectId ?? defaultProject?.id ?? projectIdFor(state.workspaceId, 'Symphony')),
        labelIds: [labelId],
        title: branch.title,
        description: branch.summary,
        status: workGraphStatusForBranch(branch.status),
        priority: branch.status === 'blocked' ? 'urgent' : 'medium',
        metadata: {
          symphonyWorkspaceId: state.workspaceId,
          symphonyRequest: state.request,
          branchName: branch.branchName,
          worktreePath: branch.worktreePath,
          role: branch.role,
          changedFiles: branch.changedFiles,
          validation: branch.validation,
          confidence: branch.confidence,
          approvedBy: state.foregroundBranchId === branch.id ? state.foregroundBranchApprovedBy : null,
        },
      },
    })),
    {
      type: 'view.create',
      actor,
      payload: {
        id: `workgraph:view:${state.workspaceId || 'workspace'}:symphony-review`,
        workspaceId,
        name: 'Symphony review queue',
        query: { status: ['In Review', 'Blocked'], labelIds: [labelId] },
      },
    },
  ];
}

export function requestMultitaskBranchChanges(
  state: MultitaskSubagentState,
  branchId: string,
  feedback: string[],
): MultitaskSubagentState {
  if (!state.branches.some((branch) => branch.id === branchId)) return state;
  return {
    ...state,
    foregroundBranchId: state.foregroundBranchId === branchId ? null : state.foregroundBranchId,
    foregroundBranchApprovedBy: state.foregroundBranchId === branchId ? null : state.foregroundBranchApprovedBy,
    branches: state.branches.map((branch) => {
      if (branch.id !== branchId) return branch;
      const reviewFeedback = feedback
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => `Reviewer feedback: ${entry}`);
      return {
        ...branch,
        status: 'queued',
        progress: 0,
        validation: [...branch.validation, ...reviewFeedback],
      };
    }),
  };
}

export function buildMultitaskPromptContext(state: MultitaskSubagentState): string {
  if (!state.enabled || state.branches.length === 0) return '';
  const promoted = state.branches.find((branch) => branch.id === state.foregroundBranchId) ?? null;
  return [
    '## Symphony Multi-Agent Worktrees',
    'Branch isolation: one worktree branch per agent',
    'Review gate: approval required before merge to the common branch',
    `Request: ${state.request || 'unspecified'}`,
    `Workspace: ${state.workspaceName || state.workspaceId || 'workspace'}`,
    `Foreground branch: ${promoted?.branchName ?? 'none selected'}`,
    `Approved by: ${promoted ? state.foregroundBranchApprovedBy ?? 'user' : 'none'}`,
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
    && (value.foregroundBranchApprovedBy === undefined
      || value.foregroundBranchApprovedBy === null
      || isMultitaskApprovalActor(value.foregroundBranchApprovedBy))
    && (value.activeProjectId === undefined || value.activeProjectId === null || typeof value.activeProjectId === 'string')
    && (value.selectedBranchId === undefined || value.selectedBranchId === null || typeof value.selectedBranchId === 'string')
    && (value.projects === undefined || (Array.isArray(value.projects) && value.projects.every(isMultitaskProject)))
    && Array.isArray(value.branches)
    && value.branches.every(isMultitaskSubagentBranch)
  );
}

function isMultitaskApprovalActor(value: unknown): value is MultitaskApprovalActor {
  return value === 'user' || value === 'reviewer-agent';
}

function isMultitaskSubagentBranch(value: unknown): value is MultitaskSubagentBranch {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.role === 'string'
    && (value.projectId === undefined || value.projectId === null || typeof value.projectId === 'string')
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

function isMultitaskProject(value: unknown): value is MultitaskProject {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.description === 'string'
    && typeof value.createdAt === 'string'
  );
}

function updateBranch(
  state: MultitaskSubagentState,
  branchId: string,
  updater: (branch: MultitaskSubagentBranch) => MultitaskSubagentBranch,
): MultitaskSubagentState {
  return {
    ...state,
    branches: state.branches.map((branch) => branch.id === branchId ? updater(branch) : branch),
  };
}

function appendValidation(validation: string[], entry: string): string[] {
  return validation.includes(entry) ? validation : [...validation, entry];
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
  if (slug) return slug;
  return 'workspace';
}

function projectsForState(state: MultitaskSubagentState): MultitaskProject[] {
  if (state.projects?.length > 0) return state.projects;
  if (!state.enabled && state.branches.length === 0) return [];
  const createdAt = state.createdAt || new Date(0).toISOString();
  return [{
    id: projectIdFor(state.workspaceId, 'symphony'),
    name: state.workspaceName || state.workspaceId || 'Symphony',
    description: state.request,
    createdAt,
  }];
}

function projectIdFor(workspaceId: string, name: string): string {
  return `multitask-project:${workspaceId || 'workspace'}:${slugify(name || 'symphony')}`;
}

function uniqueProjectId(workspaceId: string, name: string, projects: MultitaskProject[]): string {
  const baseId = projectIdFor(workspaceId, name);
  if (!projects.some((project) => project.id === baseId)) return baseId;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseId}-${index}`;
    if (!projects.some((project) => project.id === candidate)) return candidate;
  }
  return `${baseId}-${Date.now()}`;
}

function workGraphProjectId(projectId: string): string {
  return `workgraph:${projectId}`;
}

function workGraphStatusForBranch(status: MultitaskSubagentStatus): string {
  if (status === 'running') return 'In Progress';
  if (status === 'stopped') return 'Paused';
  if (status === 'blocked') return 'Blocked';
  if (status === 'ready') return 'In Review';
  if (status === 'promoted') return 'Done';
  if (status === 'cancelled') return 'Closed';
  return 'Backlog';
}

function workGraphKey(value: string): string {
  const key = value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
  return key || 'WRK';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
