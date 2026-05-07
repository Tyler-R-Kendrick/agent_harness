export type BrowserAgentRunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'archived'
  | 'deleted';

export type BrowserAgentRunMode = 'local' | 'remote';

export type BrowserAgentRunEventType =
  | 'created'
  | 'started'
  | 'message'
  | 'tool'
  | 'checkpoint'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'archived'
  | 'deleted';

export interface BrowserAgentRun {
  id: string;
  title: string;
  sessionId: string;
  workspaceId: string;
  prompt: string;
  mode: BrowserAgentRunMode;
  status: BrowserAgentRunStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  eventCursor: number;
}

export interface BrowserAgentRunEvent {
  id: string;
  runId: string;
  sequence: number;
  type: BrowserAgentRunEventType;
  createdAt: string;
  summary: string;
  payload?: Record<string, unknown>;
}

export interface BrowserAgentRunSdkState {
  runs: BrowserAgentRun[];
  events: BrowserAgentRunEvent[];
}

export interface CreateBrowserAgentRunInput {
  title: string;
  sessionId: string;
  workspaceId: string;
  prompt: string;
  mode: BrowserAgentRunMode;
}

export interface AppendBrowserAgentRunEventInput {
  type: BrowserAgentRunEventType;
  summary: string;
  payload?: Record<string, unknown>;
}

export interface StreamBrowserAgentRunEventsInput {
  runId: string;
  after?: number;
}

export interface ReconnectBrowserAgentRunInput {
  runId: string;
  cursor: number;
}

export interface BrowserAgentRunSdkClock {
  now: () => Date;
  id: (prefix: string) => string;
}

export interface BrowserAgentRunMutationResult {
  state: BrowserAgentRunSdkState;
  run: BrowserAgentRun;
  event: BrowserAgentRunEvent;
}

export interface BrowserAgentRunReconnectResult {
  run: BrowserAgentRun;
  events: BrowserAgentRunEvent[];
}

export interface BrowserAgentRunSdk {
  listRuns: () => BrowserAgentRun[];
  getRun: (runId: string) => BrowserAgentRun | null;
  createRun: (input: CreateBrowserAgentRunInput) => BrowserAgentRunMutationResult;
  appendRunEvent: (runId: string, input: AppendBrowserAgentRunEventInput) => BrowserAgentRunMutationResult;
  streamRunEvents: (input: StreamBrowserAgentRunEventsInput) => BrowserAgentRunEvent[];
  reconnectRun: (input: ReconnectBrowserAgentRunInput) => BrowserAgentRunReconnectResult | null;
  cancelRun: (runId: string, summary?: string) => BrowserAgentRunMutationResult;
  archiveRun: (runId: string, summary?: string) => BrowserAgentRunMutationResult;
  deleteRun: (runId: string, summary?: string) => BrowserAgentRunMutationResult;
}

export const DEFAULT_BROWSER_AGENT_RUN_SDK_STATE: BrowserAgentRunSdkState = {
  runs: [
    {
      id: 'sdk-launch-smoke',
      title: 'SDK launch smoke',
      sessionId: 'visual-eval-session',
      workspaceId: 'ws-research',
      prompt: 'Launch a durable browser-agent run through the typed SDK.',
      mode: 'local',
      status: 'running',
      createdAt: '2026-05-07T12:00:00.000Z',
      updatedAt: '2026-05-07T12:00:20.000Z',
      archivedAt: null,
      deletedAt: null,
      eventCursor: 3,
    },
  ],
  events: [
    {
      id: 'sdk-launch-smoke:1',
      runId: 'sdk-launch-smoke',
      sequence: 1,
      type: 'created',
      createdAt: '2026-05-07T12:00:00.000Z',
      summary: 'Typed SDK created a durable run record.',
    },
    {
      id: 'sdk-launch-smoke:2',
      runId: 'sdk-launch-smoke',
      sequence: 2,
      type: 'started',
      createdAt: '2026-05-07T12:00:10.000Z',
      summary: 'Structured event stream is live.',
    },
    {
      id: 'sdk-launch-smoke:3',
      runId: 'sdk-launch-smoke',
      sequence: 3,
      type: 'checkpoint',
      createdAt: '2026-05-07T12:00:20.000Z',
      summary: 'Reconnect cursor 3 is ready for clients.',
      payload: { cursor: 3 },
    },
  ],
};

const RUN_STATUSES: BrowserAgentRunStatus[] = ['queued', 'running', 'completed', 'failed', 'canceled', 'archived', 'deleted'];
const RUN_MODES: BrowserAgentRunMode[] = ['local', 'remote'];
const EVENT_TYPES: BrowserAgentRunEventType[] = [
  'created',
  'started',
  'message',
  'tool',
  'checkpoint',
  'completed',
  'failed',
  'canceled',
  'archived',
  'deleted',
];

const DEFAULT_CLOCK: BrowserAgentRunSdkClock = {
  now: () => new Date(),
  id: (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`,
};

export function createBrowserAgentRunSdk(
  state: BrowserAgentRunSdkState,
  clock: Partial<BrowserAgentRunSdkClock> = {},
): BrowserAgentRunSdk {
  const runtimeClock = { ...DEFAULT_CLOCK, ...clock };
  const currentState = cloneState(state);

  function getRun(runId: string): BrowserAgentRun | null {
    return currentState.runs.find((run) => run.id === runId) ?? null;
  }

  function appendRunEvent(runId: string, input: AppendBrowserAgentRunEventInput): BrowserAgentRunMutationResult {
    const run = getRun(runId);
    if (!run) {
      throw new Error(`Browser agent run "${runId}" was not found.`);
    }

    const createdAt = safeIso(runtimeClock.now());
    const sequence = run.eventCursor + 1;
    const event: BrowserAgentRunEvent = {
      id: `${runId}:${sequence}:${runtimeClock.id('event')}`,
      runId,
      sequence,
      type: input.type,
      createdAt,
      summary: input.summary,
      ...(input.payload ? { payload: { ...input.payload } } : {}),
    };
    const nextRun = applyEventToRun(run, event);
    const nextEvents = input.type === 'deleted'
      ? [event, ...currentState.events.filter((existing) => existing.runId !== runId)]
      : [...currentState.events, event];
    return {
      state: {
        runs: currentState.runs.map((entry) => (entry.id === runId ? nextRun : entry)),
        events: nextEvents,
      },
      run: nextRun,
      event,
    };
  }

  return {
    listRuns: () => currentState.runs.map((run) => ({ ...run })),
    getRun,
    createRun(input) {
      const createdAt = safeIso(runtimeClock.now());
      const runId = runtimeClock.id('run');
      const run: BrowserAgentRun = {
        id: runId,
        title: input.title,
        sessionId: input.sessionId,
        workspaceId: input.workspaceId,
        prompt: input.prompt,
        mode: input.mode,
        status: 'queued',
        createdAt,
        updatedAt: createdAt,
        archivedAt: null,
        deletedAt: null,
        eventCursor: 1,
      };
      const event: BrowserAgentRunEvent = {
        id: `${runId}:1:${runtimeClock.id('event')}`,
        runId,
        sequence: 1,
        type: 'created',
        createdAt,
        summary: `Created ${input.mode} browser-agent run.`,
      };
      return {
        state: {
          runs: [run, ...currentState.runs],
          events: [...currentState.events, event],
        },
        run,
        event,
      };
    },
    appendRunEvent,
    streamRunEvents({ runId, after = 0 }) {
      return currentState.events
        .filter((event) => event.runId === runId && event.sequence > after)
        .sort((left, right) => left.sequence - right.sequence)
        .map((event) => cloneEvent(event));
    },
    reconnectRun({ runId, cursor }) {
      const run = getRun(runId);
      if (!run) return null;
      return {
        run: { ...run },
        events: currentState.events
          .filter((event) => event.runId === runId && event.sequence > cursor)
          .sort((left, right) => left.sequence - right.sequence)
          .map((event) => cloneEvent(event)),
      };
    },
    cancelRun(runId, summary = 'Canceled through typed SDK lifecycle control.') {
      return appendRunEvent(runId, { type: 'canceled', summary });
    },
    archiveRun(runId, summary = 'Archived through typed SDK lifecycle control.') {
      return appendRunEvent(runId, { type: 'archived', summary });
    },
    deleteRun(runId, summary = 'Deleted through typed SDK lifecycle control.') {
      return appendRunEvent(runId, { type: 'deleted', summary });
    },
  };
}

export function isBrowserAgentRunSdkState(value: unknown): value is BrowserAgentRunSdkState {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.runs)
    && value.runs.every(isBrowserAgentRun)
    && Array.isArray(value.events)
    && value.events.every(isBrowserAgentRunEvent)
  );
}

function applyEventToRun(run: BrowserAgentRun, event: BrowserAgentRunEvent): BrowserAgentRun {
  const status = statusForEvent(run.status, event.type);
  return {
    ...run,
    status,
    updatedAt: event.createdAt,
    eventCursor: event.sequence,
    archivedAt: event.type === 'archived' ? event.createdAt : run.archivedAt,
    deletedAt: event.type === 'deleted' ? event.createdAt : run.deletedAt,
  };
}

function statusForEvent(
  current: BrowserAgentRunStatus,
  eventType: BrowserAgentRunEventType,
): BrowserAgentRunStatus {
  if (eventType === 'started' || eventType === 'message' || eventType === 'tool' || eventType === 'checkpoint') return 'running';
  if (eventType === 'completed') return 'completed';
  if (eventType === 'failed') return 'failed';
  if (eventType === 'canceled') return 'canceled';
  if (eventType === 'archived') return 'archived';
  if (eventType === 'deleted') return 'deleted';
  return current;
}

function cloneState(state: BrowserAgentRunSdkState): BrowserAgentRunSdkState {
  return {
    runs: state.runs.map((run) => ({ ...run })),
    events: state.events.map((event) => cloneEvent(event)),
  };
}

function cloneEvent(event: BrowserAgentRunEvent): BrowserAgentRunEvent {
  return {
    ...event,
    ...(event.payload ? { payload: { ...event.payload } } : {}),
  };
}

function safeIso(date: Date): string {
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function isBrowserAgentRun(value: unknown): value is BrowserAgentRun {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id)
    && isNonEmptyString(value.title)
    && isNonEmptyString(value.sessionId)
    && isNonEmptyString(value.workspaceId)
    && typeof value.prompt === 'string'
    && typeof value.mode === 'string'
    && (RUN_MODES as string[]).includes(value.mode)
    && typeof value.status === 'string'
    && (RUN_STATUSES as string[]).includes(value.status)
    && isIsoDateString(value.createdAt)
    && isIsoDateString(value.updatedAt)
    && (value.archivedAt === null || isIsoDateString(value.archivedAt))
    && (value.deletedAt === null || isIsoDateString(value.deletedAt))
    && typeof value.eventCursor === 'number'
    && Number.isInteger(value.eventCursor)
    && value.eventCursor >= 0
  );
}

function isBrowserAgentRunEvent(value: unknown): value is BrowserAgentRunEvent {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id)
    && isNonEmptyString(value.runId)
    && typeof value.sequence === 'number'
    && Number.isInteger(value.sequence)
    && value.sequence > 0
    && typeof value.type === 'string'
    && (EVENT_TYPES as string[]).includes(value.type)
    && isIsoDateString(value.createdAt)
    && typeof value.summary === 'string'
    && (value.payload === undefined || isRecord(value.payload))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
}
