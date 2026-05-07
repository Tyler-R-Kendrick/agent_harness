import { describe, expect, it } from 'vitest';
import {
  buildHarnessCoreSessionSnapshot,
  createHarnessCoreState,
  reduceHarnessCoreEvent,
  selectHarnessCoreSummary,
} from './harnessCore';

describe('harnessCore', () => {
  it('tracks session runtime updates without mutating previous state', () => {
    const initial = createHarnessCoreState();

    const next = reduceHarnessCoreEvent(initial, {
      type: 'session-runtime-updated',
      sessionId: 'session-1',
      runtime: {
        mode: 'agent',
        provider: 'codi',
        modelId: 'onnx-community/Qwen3-0.6B-ONNX',
        agentId: 'planner',
        toolIds: ['read-file'],
        cwd: '/workspace',
        messages: [{ role: 'user', content: 'hello' }],
      },
      ts: 1_000,
    });

    expect(initial.sessions).toEqual({});
    expect(next.sessions['session-1']?.mode).toBe('agent');
    expect(next.sessions['session-1']?.provider).toBe('codi');
    expect(next.latestEvent?.summary).toBe('session-1 runtime updated');
    expect(next.latestEvent?.ts).toBe(1_000);
  });

  it('keeps identical session runtime updates referentially stable', () => {
    const runtime = {
      mode: 'terminal' as const,
      provider: null,
      modelId: null,
      agentId: null,
      toolIds: [],
      cwd: '/workspace',
      messages: [],
    };
    const withSession = reduceHarnessCoreEvent(createHarnessCoreState(), {
      type: 'session-runtime-updated',
      sessionId: 'session-1',
      runtime,
    });

    const unchanged = reduceHarnessCoreEvent(withSession, {
      type: 'session-runtime-updated',
      sessionId: 'session-1',
      runtime,
    });

    expect(unchanged).toBe(withSession);
  });

  it('removes session runtime snapshots and reports active core capabilities', () => {
    const withSession = reduceHarnessCoreEvent(createHarnessCoreState(), {
      type: 'session-runtime-updated',
      sessionId: 'session-1',
      runtime: {
        mode: 'terminal',
        provider: null,
        modelId: null,
        agentId: null,
        toolIds: [],
        cwd: '/workspace',
        messages: [],
      },
    });

    const removed = reduceHarnessCoreEvent(withSession, {
      type: 'session-runtime-removed',
      sessionId: 'session-1',
      ts: 2_000,
    });

    const summary = selectHarnessCoreSummary(removed);
    expect(removed.sessions['session-1']).toBeUndefined();
    expect(summary.activeSessionCount).toBe(0);
    expect(summary.capabilities).toContain('thread lifecycle');
    expect(summary.capabilities).toContain('event streaming');
    expect(summary.latestEventSummary).toBe('session-1 runtime removed');
  });

  it('streams generic lifecycle events into the core summary', () => {
    const state = reduceHarnessCoreEvent(createHarnessCoreState(), {
      type: 'event-streamed',
      summary: 'approval policy refreshed',
      ts: 3_000,
    });

    expect(state.eventCount).toBe(1);
    expect(selectHarnessCoreSummary(state).latestEventSummary).toBe('approval policy refreshed');
  });

  it('builds dashboard session snapshots from core runtime and assets', () => {
    const snapshot = buildHarnessCoreSessionSnapshot(
      { id: 'session-1', name: 'Research', type: 'tab', nodeKind: 'session' },
      {
        mode: 'agent',
        provider: 'ghcp',
        modelId: 'gpt-5.4',
        agentId: 'researcher',
        toolIds: ['search'],
        cwd: '/workspace',
        messages: [],
      },
      [{ path: 'notes.md', size: 42 }],
    );

    expect(snapshot.provider).toBe('ghcp');
    expect(snapshot.modelId).toBe('gpt-5.4');
    expect(snapshot.assets).toEqual([{ path: 'notes.md', size: 42 }]);
  });
});
