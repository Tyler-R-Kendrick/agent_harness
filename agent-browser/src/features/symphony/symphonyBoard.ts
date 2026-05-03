export type SymphonyLaneId =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'human_review'
  | 'rework'
  | 'merging'
  | 'done'
  | 'canceled'
  | 'duplicate';

export type SymphonyTaskPriority = 'urgent' | 'high' | 'normal' | 'low';
export type SymphonyAgentState = 'idle' | 'assigned' | 'running' | 'blocked' | 'retrying' | 'reviewing' | 'merging' | 'complete';
export type SymphonyAgentHealth = 'healthy' | 'waiting' | 'blocked' | 'failed';
export type SymphonyProofStatus = 'pending' | 'passing' | 'failing';
export type SymphonyActivityKind = 'created' | 'agent' | 'status' | 'proof' | 'review' | 'merge';

export interface SymphonyLaneDefinition {
  id: SymphonyLaneId;
  title: string;
  description: string;
}

export interface SymphonyProof {
  id: string;
  label: string;
  status: SymphonyProofStatus;
}

export interface SymphonyActivityEvent {
  id: string;
  kind: SymphonyActivityKind;
  label: string;
  detail: string;
  at: string;
}

export interface SymphonyTaskAgent {
  id: string;
  name: string;
  state: SymphonyAgentState;
  health: SymphonyAgentHealth;
  lastAction: string;
  sessionId?: string;
  sessionName?: string;
  workspacePath?: string;
  tokens: number;
  runtimeMinutes: number;
  retryCount: number;
}

export interface SymphonyTask {
  id: string;
  identifier: string;
  title: string;
  description: string;
  lane: SymphonyLaneId;
  priority: SymphonyTaskPriority;
  labels: string[];
  agent: SymphonyTaskAgent;
  proofs: SymphonyProof[];
  activity: SymphonyActivityEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface SymphonyBoardState {
  tasks: SymphonyTask[];
  selectedTaskId: string | null;
  nextIssueNumber: number;
  hiddenLanesExpanded: boolean;
  paused: boolean;
  maxConcurrentAgents: number;
}

export interface SymphonyBoardMetrics {
  activeAgents: number;
  blockedAgents: number;
  humanReview: number;
  queued: number;
  totalTasks: number;
  tokenTotal: number;
  runtimeMinutes: number;
}

export interface CreateSymphonyTaskInput {
  title: string;
  description: string;
  priority?: SymphonyTaskPriority;
  lane?: SymphonyLaneId;
  labels?: string[];
}

export interface DispatchSymphonyTaskInput {
  sessionId?: string;
  sessionName?: string;
  workspacePath?: string;
}

const DEFAULT_NOW = '2026-05-02T15:00:00.000Z';

export const SYMPHONY_VISIBLE_LANES: SymphonyLaneDefinition[] = [
  { id: 'backlog', title: 'Backlog', description: 'Captured work that has not entered the agent queue.' },
  { id: 'todo', title: 'Todo', description: 'Ready for an agent sandbox.' },
  { id: 'in_progress', title: 'In Progress', description: 'Agents are planning, editing, or testing.' },
  { id: 'human_review', title: 'Human Review', description: 'Waiting on a person to approve, redirect, or merge.' },
];

export const SYMPHONY_HIDDEN_LANES: SymphonyLaneDefinition[] = [
  { id: 'rework', title: 'Rework', description: 'Returned from review with follow-up changes.' },
  { id: 'merging', title: 'Merging', description: 'Approved and waiting for checks or merge automation.' },
  { id: 'done', title: 'Done', description: 'Merged or otherwise completed.' },
  { id: 'canceled', title: 'Canceled', description: 'Closed without action.' },
  { id: 'duplicate', title: 'Duplicate', description: 'Closed in favor of another task.' },
];

export const SYMPHONY_ALL_LANES: SymphonyLaneDefinition[] = [
  ...SYMPHONY_VISIBLE_LANES,
  ...SYMPHONY_HIDDEN_LANES,
];

const LANE_TITLES = new Map<SymphonyLaneId, string>(SYMPHONY_ALL_LANES.map((lane) => [lane.id, lane.title]));
const LANE_IDS = new Set<SymphonyLaneId>(SYMPHONY_ALL_LANES.map((lane) => lane.id));
const PRIORITIES = new Set<SymphonyTaskPriority>(['urgent', 'high', 'normal', 'low']);
const AGENT_STATES = new Set<SymphonyAgentState>(['idle', 'assigned', 'running', 'blocked', 'retrying', 'reviewing', 'merging', 'complete']);
const AGENT_HEALTH = new Set<SymphonyAgentHealth>(['healthy', 'waiting', 'blocked', 'failed']);
const PROOF_STATUSES = new Set<SymphonyProofStatus>(['pending', 'passing', 'failing']);
const ACTIVITY_KINDS = new Set<SymphonyActivityKind>(['created', 'agent', 'status', 'proof', 'review', 'merge']);

export function createDefaultSymphonyBoardState(workspaceName: string, now = DEFAULT_NOW): SymphonyBoardState {
  return {
    tasks: [
      createSeedTask({
        id: 'task-mt-891',
        identifier: 'MT-891',
        title: 'Summarize feedback from Slack channels',
        description: `Collect support, ops, and rider-feedback threads for ${workspaceName}, then open a review-ready summary with prioritized fixes.`,
        lane: 'backlog',
        priority: 'high',
        labels: ['research', 'slack'],
        agent: agentSeed('idle', 'waiting', 'Waiting for dispatch', 0, 0),
        now,
      }),
      createSeedTask({
        id: 'task-mt-890',
        identifier: 'MT-890',
        title: 'Upgrade to latest React version',
        description: 'Run the dependency upgrade, repair build/test fallout, and present the diff for human review.',
        lane: 'todo',
        priority: 'urgent',
        labels: ['frontend', 'dependencies'],
        agent: agentSeed('assigned', 'waiting', 'Queued for next available agent', 0, 0),
        now,
      }),
      createSeedTask({
        id: 'task-mt-889',
        identifier: 'MT-889',
        title: 'Move to Vite',
        description: 'Replace the legacy dev server with Vite, keep routing intact, and prove the build remains green.',
        lane: 'in_progress',
        priority: 'high',
        labels: ['build', 'migration'],
        agent: {
          ...agentSeed('running', 'healthy', 'Running build parity checks', 18420, 42),
          sessionId: 'session-mt-889',
          sessionName: 'MT-889',
        },
        now,
      }),
      createSeedTask({
        id: 'task-mt-888',
        identifier: 'MT-888',
        title: 'Add station crowding badges',
        description: 'Surface occupancy and crowding signals on station detail screens with deterministic mock data.',
        lane: 'human_review',
        priority: 'normal',
        labels: ['ux', 'review'],
        agent: agentSeed('reviewing', 'waiting', 'Waiting for human review', 12900, 36),
        now,
      }),
      createSeedTask({
        id: 'task-mt-887',
        identifier: 'MT-887',
        title: 'Fix train line color contrast',
        description: 'Repair contrast failures found during visual QA and rerun accessibility checks.',
        lane: 'rework',
        priority: 'normal',
        labels: ['accessibility'],
        agent: agentSeed('retrying', 'blocked', 'Review requested contrast cleanup', 7300, 28, 1),
        now,
      }),
      createSeedTask({
        id: 'task-mt-886',
        identifier: 'MT-886',
        title: 'Archive old timetable parser',
        description: 'Remove the unused parser after confirming no runtime imports remain.',
        lane: 'done',
        priority: 'low',
        labels: ['cleanup'],
        agent: agentSeed('complete', 'healthy', 'Merged after checks passed', 4300, 19),
        now,
      }),
    ],
    selectedTaskId: 'task-mt-891',
    nextIssueNumber: 892,
    hiddenLanesExpanded: false,
    paused: false,
    maxConcurrentAgents: 3,
  };
}

export function createSymphonyTask(
  board: SymphonyBoardState,
  input: CreateSymphonyTaskInput,
  now = new Date().toISOString(),
): [SymphonyBoardState, SymphonyTask] {
  const issueNumber = board.nextIssueNumber;
  const identifier = `MT-${issueNumber}`;
  const id = `task-mt-${issueNumber}`;
  const task: SymphonyTask = {
    id,
    identifier,
    title: input.title.trim(),
    description: input.description.trim(),
    lane: input.lane ?? 'todo',
    priority: input.priority ?? 'normal',
    labels: input.labels ?? [],
    agent: agentSeed('idle', 'waiting', 'Waiting for dispatch', 0, 0),
    proofs: defaultProofs(),
    activity: [activity(`${id}-created`, 'created', 'Task created', 'Added to the Symphony board.', now)],
    createdAt: now,
    updatedAt: now,
  };

  return [
    {
      ...board,
      tasks: [...board.tasks, task],
      selectedTaskId: task.id,
      nextIssueNumber: board.nextIssueNumber + 1,
    },
    task,
  ];
}

export function selectSymphonyTask(board: SymphonyBoardState, taskId: string | null): SymphonyBoardState {
  if (taskId === null) return { ...board, selectedTaskId: null };
  return board.tasks.some((task) => task.id === taskId)
    ? { ...board, selectedTaskId: taskId }
    : board;
}

export function toggleSymphonyHiddenLanes(board: SymphonyBoardState): SymphonyBoardState {
  return { ...board, hiddenLanesExpanded: !board.hiddenLanesExpanded };
}

export function toggleSymphonyQueuePaused(board: SymphonyBoardState): SymphonyBoardState {
  return { ...board, paused: !board.paused };
}

export function moveSymphonyTask(
  board: SymphonyBoardState,
  taskId: string,
  lane: SymphonyLaneId,
  now = new Date().toISOString(),
): SymphonyBoardState {
  return updateTask(board, taskId, (task) => {
    const nextAgent = agentForLane(task.agent, lane);
    return {
      ...task,
      lane,
      agent: nextAgent,
      updatedAt: now,
      activity: [
        activity(`${task.id}-move-${now}`, lane === 'merging' ? 'merge' : 'status', `Moved to ${LANE_TITLES.get(lane) ?? lane}`, `Status changed from ${LANE_TITLES.get(task.lane) ?? task.lane}.`, now),
        ...task.activity,
      ],
    };
  });
}

export function dispatchSymphonyTask(
  board: SymphonyBoardState,
  taskId: string,
  dispatch: DispatchSymphonyTaskInput = {},
  now = new Date().toISOString(),
): SymphonyBoardState {
  return updateTask(board, taskId, (task) => {
    const sessionName = dispatch.sessionName ?? task.identifier;
    return {
      ...task,
      lane: 'in_progress',
      agent: {
        ...task.agent,
        state: 'running',
        health: 'healthy',
        sessionId: dispatch.sessionId,
        sessionName,
        workspacePath: dispatch.workspacePath,
        lastAction: `Opened ${task.identifier} in ${sessionName}`,
      },
      updatedAt: now,
      activity: [
        activity(`${task.id}-dispatch-${now}`, 'agent', 'Agent running', `Opened an agent session for ${task.identifier}.`, now),
        ...task.activity,
      ],
    };
  });
}

export function advanceSymphonyTask(
  board: SymphonyBoardState,
  taskId: string,
  now = new Date().toISOString(),
): SymphonyBoardState {
  const task = board.tasks.find((entry) => entry.id === taskId);
  if (!task) return board;
  const nextLane: SymphonyLaneId = task.lane === 'in_progress'
    ? 'human_review'
    : task.lane === 'human_review'
      ? 'merging'
      : task.lane === 'merging'
        ? 'done'
        : task.lane;
  return moveSymphonyTask(board, taskId, nextLane, now);
}

export function markSymphonyProofPassing(
  board: SymphonyBoardState,
  taskId: string,
  proofId: string,
  now = new Date().toISOString(),
): SymphonyBoardState {
  return updateTask(board, taskId, (task) => ({
    ...task,
    proofs: task.proofs.map((proof) => proof.id === proofId ? { ...proof, status: 'passing' } : proof),
    updatedAt: now,
    activity: [
      activity(`${task.id}-proof-${proofId}-${now}`, 'proof', 'Proof passed', `${proofId} marked passing.`, now),
      ...task.activity,
    ],
  }));
}

export function getSymphonyBoardMetrics(board: SymphonyBoardState): SymphonyBoardMetrics {
  return board.tasks.reduce<SymphonyBoardMetrics>((metrics, task) => ({
    activeAgents: metrics.activeAgents + (task.agent.state === 'running' ? 1 : 0),
    blockedAgents: metrics.blockedAgents + (task.agent.health === 'blocked' || task.agent.health === 'failed' ? 1 : 0),
    humanReview: metrics.humanReview + (task.lane === 'human_review' ? 1 : 0),
    queued: metrics.queued + (task.lane === 'backlog' || task.lane === 'todo' ? 1 : 0),
    totalTasks: metrics.totalTasks + 1,
    tokenTotal: metrics.tokenTotal + task.agent.tokens,
    runtimeMinutes: metrics.runtimeMinutes + task.agent.runtimeMinutes,
  }), {
    activeAgents: 0,
    blockedAgents: 0,
    humanReview: 0,
    queued: 0,
    totalTasks: 0,
    tokenTotal: 0,
    runtimeMinutes: 0,
  });
}

export function getSymphonyTasksByLane(board: SymphonyBoardState, laneId: SymphonyLaneId): SymphonyTask[] {
  return board.tasks.filter((task) => task.lane === laneId);
}

export function isSymphonyBoardRecord(value: unknown): value is Record<string, SymphonyBoardState> {
  return isRecord(value) && Object.values(value).every(isSymphonyBoardState);
}

export function isSymphonyBoardState(value: unknown): value is SymphonyBoardState {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.tasks)
    && value.tasks.every(isSymphonyTask)
    && (value.selectedTaskId === null || typeof value.selectedTaskId === 'string')
    && typeof value.nextIssueNumber === 'number'
    && typeof value.hiddenLanesExpanded === 'boolean'
    && typeof value.paused === 'boolean'
    && typeof value.maxConcurrentAgents === 'number'
  );
}

function createSeedTask({
  id,
  identifier,
  title,
  description,
  lane,
  priority,
  labels,
  agent,
  now,
}: {
  id: string;
  identifier: string;
  title: string;
  description: string;
  lane: SymphonyLaneId;
  priority: SymphonyTaskPriority;
  labels: string[];
  agent: SymphonyTaskAgent;
  now: string;
}): SymphonyTask {
  return {
    id,
    identifier,
    title,
    description,
    lane,
    priority,
    labels,
    agent,
    proofs: defaultProofs(),
    activity: [activity(`${id}-seed`, 'created', 'Imported from Linear', 'Seeded from the Symphony demo board.', now)],
    createdAt: now,
    updatedAt: now,
  };
}

function agentSeed(
  state: SymphonyAgentState,
  health: SymphonyAgentHealth,
  lastAction: string,
  tokens: number,
  runtimeMinutes: number,
  retryCount = 0,
): SymphonyTaskAgent {
  return {
    id: `agent-${state}-${tokens}-${runtimeMinutes}`,
    name: state === 'idle' ? 'Unassigned' : `Agent ${Math.max(1, Math.ceil(runtimeMinutes / 10))}`,
    state,
    health,
    lastAction,
    tokens,
    runtimeMinutes,
    retryCount,
  };
}

function defaultProofs(): SymphonyProof[] {
  return [
    { id: 'plan', label: 'plan', status: 'pending' },
    { id: 'tests', label: 'tests', status: 'pending' },
    { id: 'visual', label: 'visual', status: 'pending' },
  ];
}

function activity(
  id: string,
  kind: SymphonyActivityKind,
  label: string,
  detail: string,
  at: string,
): SymphonyActivityEvent {
  return { id, kind, label, detail, at };
}

function updateTask(
  board: SymphonyBoardState,
  taskId: string,
  update: (task: SymphonyTask) => SymphonyTask,
): SymphonyBoardState {
  let found = false;
  const tasks = board.tasks.map((task) => {
    if (task.id !== taskId) return task;
    found = true;
    return update(task);
  });
  return found ? { ...board, tasks, selectedTaskId: taskId } : board;
}

function agentForLane(agent: SymphonyTaskAgent, lane: SymphonyLaneId): SymphonyTaskAgent {
  if (lane === 'in_progress') return { ...agent, state: 'running', health: 'healthy', lastAction: 'Running implementation' };
  if (lane === 'human_review') return { ...agent, state: 'reviewing', health: 'waiting', lastAction: 'Waiting for human review' };
  if (lane === 'rework') return { ...agent, state: 'retrying', health: 'blocked', retryCount: agent.retryCount + 1, lastAction: 'Review requested rework' };
  if (lane === 'merging') return { ...agent, state: 'merging', health: 'waiting', lastAction: 'Waiting for checks and merge' };
  if (lane === 'done') return { ...agent, state: 'complete', health: 'healthy', lastAction: 'Done' };
  if (lane === 'canceled' || lane === 'duplicate') return { ...agent, state: 'complete', health: 'waiting', lastAction: `Closed as ${lane}` };
  return { ...agent, state: lane === 'todo' ? 'assigned' : 'idle', health: 'waiting', lastAction: lane === 'todo' ? 'Queued for next available agent' : 'Waiting for dispatch' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isSymphonyTask(value: unknown): value is SymphonyTask {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.identifier === 'string'
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof value.lane === 'string'
    && LANE_IDS.has(value.lane as SymphonyLaneId)
    && typeof value.priority === 'string'
    && PRIORITIES.has(value.priority as SymphonyTaskPriority)
    && isStringArray(value.labels)
    && isSymphonyTaskAgent(value.agent)
    && Array.isArray(value.proofs)
    && value.proofs.every(isSymphonyProof)
    && Array.isArray(value.activity)
    && value.activity.every(isSymphonyActivityEvent)
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string'
  );
}

function isSymphonyTaskAgent(value: unknown): value is SymphonyTaskAgent {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.state === 'string'
    && AGENT_STATES.has(value.state as SymphonyAgentState)
    && typeof value.health === 'string'
    && AGENT_HEALTH.has(value.health as SymphonyAgentHealth)
    && typeof value.lastAction === 'string'
    && (value.sessionId === undefined || typeof value.sessionId === 'string')
    && (value.sessionName === undefined || typeof value.sessionName === 'string')
    && (value.workspacePath === undefined || typeof value.workspacePath === 'string')
    && typeof value.tokens === 'number'
    && typeof value.runtimeMinutes === 'number'
    && typeof value.retryCount === 'number'
  );
}

function isSymphonyProof(value: unknown): value is SymphonyProof {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.status === 'string'
    && PROOF_STATUSES.has(value.status as SymphonyProofStatus)
  );
}

function isSymphonyActivityEvent(value: unknown): value is SymphonyActivityEvent {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.kind === 'string'
    && ACTIVITY_KINDS.has(value.kind as SymphonyActivityKind)
    && typeof value.label === 'string'
    && typeof value.detail === 'string'
    && typeof value.at === 'string'
  );
}
