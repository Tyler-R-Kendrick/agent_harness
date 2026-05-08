import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHARED_SESSION_CONTROL_STATE,
  buildSharedSessionControlPromptContext,
  formatSharedSessionPeerMessage,
  isSharedSessionControlState,
  recordSharedSessionControlEvent,
  type SharedSessionControlState,
} from './sharedSessionControl';

describe('shared session remote control state', () => {
  it('validates the default state and rejects malformed persisted records', () => {
    expect(isSharedSessionControlState(DEFAULT_SHARED_SESSION_CONTROL_STATE)).toBe(true);
    expect(isSharedSessionControlState({
      ...DEFAULT_SHARED_SESSION_CONTROL_STATE,
      activeSessions: [{ sessionId: 's1', status: 'unknown' }],
    })).toBe(false);
  });

  it('records shared-session lifecycle events into an active summary and audit trail', () => {
    const opened = recordSharedSessionControlEvent(DEFAULT_SHARED_SESSION_CONTROL_STATE, {
      sessionId: 'session-a',
      workspaceName: 'Agent Harness',
      event: 'session.opened',
      actor: 'Owner device',
      peerLabel: 'Maya',
      deviceLabel: 'iPad Pro',
      createdAt: '2026-05-07T21:30:00.000Z',
    });
    const active = recordSharedSessionControlEvent(opened, {
      sessionId: 'session-a',
      workspaceName: 'Agent Harness',
      event: 'pairing.confirmed',
      actor: 'Maya',
      peerLabel: 'Maya',
      deviceLabel: 'iPad Pro',
      createdAt: '2026-05-07T21:31:00.000Z',
    });

    expect(active.activeSessions).toEqual([{
      sessionId: 'session-a',
      workspaceName: 'Agent Harness',
      peerLabel: 'Maya',
      deviceLabel: 'iPad Pro',
      status: 'active',
      eventCount: 2,
      lastEventAt: '2026-05-07T21:31:00.000Z',
    }]);
    expect(active.audit[0]?.summary).toBe('Maya confirmed pairing for Maya on iPad Pro.');
  });

  it('formats remote peer messages with user and device labels', () => {
    expect(formatSharedSessionPeerMessage({
      text: 'continue this run from the tablet',
      peerLabel: 'Maya',
      deviceLabel: 'iPad Pro',
    })).toBe('Shared from Maya (iPad Pro):\ncontinue this run from the tablet');
  });

  it('builds prompt context only for active shared sessions', () => {
    const state = recordSharedSessionControlEvent(DEFAULT_SHARED_SESSION_CONTROL_STATE, {
      sessionId: 'session-a',
      workspaceName: 'Agent Harness',
      event: 'pairing.confirmed',
      actor: 'Maya',
      peerLabel: 'Maya',
      deviceLabel: 'iPad Pro',
      createdAt: '2026-05-07T21:31:00.000Z',
    });

    expect(buildSharedSessionControlPromptContext(state, 'session-a')).toContain('Remote control: enabled');
    expect(buildSharedSessionControlPromptContext(state, 'session-b')).toBe('');
  });

  it('bounds audit history to the newest 50 events', () => {
    const state = Array.from({ length: 55 }).reduce<SharedSessionControlState>((current, _, index) => recordSharedSessionControlEvent(current, {
      sessionId: 'session-a',
      workspaceName: 'Agent Harness',
      event: 'message.created',
      actor: 'Maya',
      peerLabel: 'Maya',
      deviceLabel: 'iPad Pro',
      createdAt: new Date(Date.UTC(2026, 4, 7, 21, index)).toISOString(),
    }), DEFAULT_SHARED_SESSION_CONTROL_STATE);

    expect(state.audit).toHaveLength(50);
    expect(state.audit[0]?.createdAt).toBe('2026-05-07T21:54:00.000Z');
    expect(state.activeSessions[0]?.eventCount).toBe(55);
  });
});
