import type { AgentProvider } from '../chat-agents';

export type HarnessCoreMode = 'agent' | 'terminal';

export interface HarnessCoreMessageSnapshot {
  role: 'user' | 'assistant' | 'system';
  content: string;
  status?: string | null;
}

export interface HarnessCoreSessionRuntime {
  mode: HarnessCoreMode;
  provider: AgentProvider | null;
  modelId: string | null;
  agentId: string | null;
  toolIds: string[];
  cwd: string | null;
  messages: HarnessCoreMessageSnapshot[];
}

export interface HarnessCoreLifecycleEvent {
  id: string;
  ts: number;
  summary: string;
}

export interface HarnessCoreState {
  sessions: Record<string, HarnessCoreSessionRuntime>;
  eventCount: number;
  latestEvent: HarnessCoreLifecycleEvent | null;
}

export type HarnessCoreEvent =
  | {
    type: 'session-runtime-updated';
    sessionId: string;
    runtime: HarnessCoreSessionRuntime;
    ts?: number;
  }
  | {
    type: 'session-runtime-removed';
    sessionId: string;
    ts?: number;
  }
  | {
    type: 'event-streamed';
    summary: string;
    ts?: number;
  };

export const HARNESS_CORE_CAPABILITIES = [
  'mode state',
  'thread lifecycle',
  'approval tools',
  'memory hooks',
  'subagent orchestration',
  'model discovery',
  'event streaming',
] as const;

export function createHarnessCoreState(): HarnessCoreState {
  return {
    sessions: {},
    eventCount: 0,
    latestEvent: null,
  };
}

export function areHarnessSessionRuntimeSnapshotsEqual(
  left: HarnessCoreSessionRuntime | undefined,
  right: HarnessCoreSessionRuntime,
): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right);
}

export function reduceHarnessCoreEvent(
  state: HarnessCoreState,
  event: HarnessCoreEvent,
): HarnessCoreState {
  if (event.type === 'session-runtime-updated') {
    if (areHarnessSessionRuntimeSnapshotsEqual(state.sessions[event.sessionId], event.runtime)) {
      return state;
    }
    return {
      sessions: {
        ...state.sessions,
        [event.sessionId]: event.runtime,
      },
      eventCount: state.eventCount + 1,
      latestEvent: {
        id: `event-${state.eventCount + 1}`,
        ts: event.ts ?? Date.now(),
        summary: `${event.sessionId} runtime updated`,
      },
    };
  }

  if (event.type === 'session-runtime-removed') {
    if (!state.sessions[event.sessionId]) {
      return state;
    }
    const sessions = { ...state.sessions };
    delete sessions[event.sessionId];
    return {
      sessions,
      eventCount: state.eventCount + 1,
      latestEvent: {
        id: `event-${state.eventCount + 1}`,
        ts: event.ts ?? Date.now(),
        summary: `${event.sessionId} runtime removed`,
      },
    };
  }

  return {
    ...state,
    eventCount: state.eventCount + 1,
    latestEvent: {
      id: `event-${state.eventCount + 1}`,
      ts: event.ts ?? Date.now(),
      summary: event.summary,
    },
  };
}

export function selectHarnessCoreSummary(state: HarnessCoreState) {
  return {
    activeSessionCount: Object.keys(state.sessions).length,
    capabilityCount: HARNESS_CORE_CAPABILITIES.length,
    capabilities: [...HARNESS_CORE_CAPABILITIES],
    latestEventSummary: state.latestEvent?.summary ?? 'No session events yet',
  };
}

export function buildHarnessCoreSessionSnapshot<TSession extends { id: string; name: string }, TAsset>(
  session: TSession,
  runtime: HarnessCoreSessionRuntime | undefined,
  assets: TAsset[],
): TSession & Partial<HarnessCoreSessionRuntime> & { assets: TAsset[] } {
  return {
    ...session,
    ...(runtime ?? {}),
    assets,
  };
}
