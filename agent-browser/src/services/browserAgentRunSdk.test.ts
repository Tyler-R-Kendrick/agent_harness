import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BROWSER_AGENT_RUN_SDK_STATE,
  createBrowserAgentRunSdk,
  isBrowserAgentRunSdkState,
} from './browserAgentRunSdk';

describe('browserAgentRunSdk', () => {
  it('creates typed durable runs and streams missed events by cursor', () => {
    const sdk = createBrowserAgentRunSdk(DEFAULT_BROWSER_AGENT_RUN_SDK_STATE, {
      now: () => new Date('2026-05-07T12:00:00.000Z'),
      id: (prefix) => `${prefix}-1`,
    });

    const created = sdk.createRun({
      title: 'SDK smoke run',
      sessionId: 's1',
      workspaceId: 'ws1',
      prompt: 'test',
      mode: 'local',
    });
    const started = createBrowserAgentRunSdk(created.state, {
      now: () => new Date('2026-05-07T12:00:01.000Z'),
      id: (prefix) => `${prefix}-2`,
    }).appendRunEvent(created.run.id, {
      type: 'started',
      summary: 'Runtime accepted run.',
    });
    const message = createBrowserAgentRunSdk(started.state, {
      now: () => new Date('2026-05-07T12:00:02.000Z'),
      id: (prefix) => `${prefix}-3`,
    }).appendRunEvent(created.run.id, {
      type: 'message',
      summary: 'Agent streamed output.',
      payload: { chunk: 'hello' },
    });

    expect(message.run.status).toBe('running');
    expect(message.event.sequence).toBe(3);
    expect(
      createBrowserAgentRunSdk(message.state).streamRunEvents({ runId: created.run.id, after: 1 }).map((event) => event.type),
    ).toEqual(['started', 'message']);
  });

  it('supports reconnect, cancellation, archive, and delete tombstones', () => {
    const sdk = createBrowserAgentRunSdk(DEFAULT_BROWSER_AGENT_RUN_SDK_STATE, {
      now: () => new Date('2026-05-07T12:00:00.000Z'),
      id: (prefix) => `${prefix}-2`,
    });
    const created = sdk.createRun({
      title: 'Remote run',
      sessionId: 's2',
      workspaceId: 'ws1',
      prompt: 'remote',
      mode: 'remote',
    });
    const canceled = createBrowserAgentRunSdk(created.state, {
      now: () => new Date('2026-05-07T12:00:01.000Z'),
      id: (prefix) => `${prefix}-cancel`,
    }).cancelRun(created.run.id, 'Operator canceled from SDK.');
    const archived = createBrowserAgentRunSdk(canceled.state, {
      now: () => new Date('2026-05-07T12:00:02.000Z'),
      id: (prefix) => `${prefix}-archive`,
    }).archiveRun(created.run.id, 'Archived after review.');
    const deleted = createBrowserAgentRunSdk(archived.state, {
      now: () => new Date('2026-05-07T12:00:03.000Z'),
      id: (prefix) => `${prefix}-delete`,
    }).deleteRun(created.run.id, 'Deleted by lifecycle API.');

    expect(deleted.run.status).toBe('deleted');
    expect(deleted.run.deletedAt).toBe('2026-05-07T12:00:03.000Z');
    expect(
      createBrowserAgentRunSdk(deleted.state).reconnectRun({ runId: created.run.id, cursor: 0 })?.events.map((event) => event.type),
    ).toEqual(['deleted']);
  });

  it('validates only well-formed persisted SDK state', () => {
    expect(isBrowserAgentRunSdkState(DEFAULT_BROWSER_AGENT_RUN_SDK_STATE)).toBe(true);
    expect(isBrowserAgentRunSdkState({ runs: [{ status: 'maybe' }], events: [] })).toBe(false);
    expect(isBrowserAgentRunSdkState({ runs: [], events: 'bad' })).toBe(false);
  });
});
