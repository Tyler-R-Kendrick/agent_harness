import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types';
import type { ProcessEntry } from './processLog';
import {
  DEFAULT_TRAJECTORY_CRITIC_SETTINGS,
  evaluateTrajectory,
  isTrajectoryCriticSettings,
  normalizeTrajectoryCriticSettings,
} from './trajectoryCritic';

const entry = (overrides: Partial<ProcessEntry>): ProcessEntry => ({
  id: overrides.id ?? 'entry-1',
  position: overrides.position ?? 0,
  ts: overrides.ts ?? 1,
  kind: overrides.kind ?? 'reasoning',
  actor: overrides.actor ?? 'agent',
  summary: overrides.summary ?? 'Thinking',
  status: overrides.status ?? 'done',
  ...overrides,
});

const assistantMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: overrides.id ?? 'message-1',
  role: 'assistant',
  content: overrides.content ?? '',
  ...overrides,
});

describe('trajectoryCritic', () => {
  it('continues high-confidence completed trajectories', () => {
    const result = evaluateTrajectory({
      entries: [
        entry({ id: 'tool', kind: 'tool-result', summary: 'Tests passed', transcript: 'ok' }),
        entry({ id: 'done', kind: 'completion', summary: 'Completion passed' }),
      ],
    });

    expect(result.enabled).toBe(true);
    expect(result.action).toBe('continue');
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.summary).toMatch(/continue/i);
    expect(result.reasons.some((reason) => reason.kind === 'confidence')).toBe(true);
  });

  it('treats zero-failure tool output as a useful result instead of a tool error', () => {
    const result = evaluateTrajectory({
      entries: [
        entry({
          id: 'tool',
          kind: 'tool-result',
          summary: 'Tests passed',
          transcript: '20 passed, 0 failed, 0 errors',
        }),
      ],
    });

    expect(result.action).toBe('continue');
    expect(result.reasons.map((reason) => reason.code)).toContain('useful-tool-result');
    expect(result.reasons.map((reason) => reason.code)).not.toContain('tool-error');
  });

  it('recommends retry for recoverable tool errors', () => {
    const result = evaluateTrajectory({
      entries: [
        entry({ id: 'tool', kind: 'tool-result', summary: 'Command error', transcript: 'Error: test failed' }),
      ],
      settings: DEFAULT_TRAJECTORY_CRITIC_SETTINGS,
    });

    expect(result.action).toBe('retry');
    expect(result.score).toBeLessThan(DEFAULT_TRAJECTORY_CRITIC_SETTINGS.retryThreshold);
    expect(result.reasons.map((reason) => reason.code)).toContain('tool-error');
  });

  it('recommends branch or stop for severe trajectory failures', () => {
    const branch = evaluateTrajectory({
      entries: [
        entry({
          id: 'vote',
          kind: 'vote',
          summary: 'Voter rejected',
          transcript: 'incorrect',
          payload: { approve: false },
        }),
        entry({ id: 'tool', kind: 'tool-result', summary: 'Command error', transcript: 'Error: failed' }),
      ],
    });
    const stop = evaluateTrajectory({
      entries: [
        entry({ id: 'fail', kind: 'tool-result', summary: 'Failed', status: 'failed', transcript: 'Error: failed' }),
        entry({ id: 'abort', kind: 'abort', summary: 'Abort', transcript: 'unsafe' }),
      ],
      message: assistantMessage({ isError: true }),
    });

    expect(branch.action).toBe('branch');
    expect(branch.reasons.map((reason) => reason.code)).toEqual(expect.arrayContaining(['vote-rejected', 'tool-error']));
    expect(stop.action).toBe('stop');
    expect(stop.reasons.map((reason) => reason.code)).toEqual(expect.arrayContaining(['failed-entry', 'abort', 'assistant-error']));
  });

  it('asks for human review when confidence is below the review threshold but above retry thresholds', () => {
    const result = evaluateTrajectory({
      entries: [
        entry({ id: 'active-1', kind: 'reasoning', summary: 'Still active', status: 'active' }),
        entry({ id: 'active-2', kind: 'tool-call', summary: 'Still running', status: 'active' }),
      ],
      message: assistantMessage({ status: 'complete' }),
    });

    expect(result.action).toBe('human-review');
    expect(result.reasons.map((reason) => reason.code)).toContain('stale-active');
  });

  it('normalizes invalid settings to defaults', () => {
    expect(isTrajectoryCriticSettings(DEFAULT_TRAJECTORY_CRITIC_SETTINGS)).toBe(true);
    expect(isTrajectoryCriticSettings({
      enabled: true,
      stopThreshold: 0.6,
      branchThreshold: 0.4,
      retryThreshold: 0.5,
      humanReviewThreshold: 0.7,
    })).toBe(false);
    expect(normalizeTrajectoryCriticSettings({
      enabled: false,
      stopThreshold: 0.1,
      branchThreshold: 0.2,
      retryThreshold: 0.3,
      humanReviewThreshold: 0.4,
    }).enabled).toBe(false);
    expect(normalizeTrajectoryCriticSettings({ enabled: 'yes' }).enabled).toBe(true);
  });

  it('returns a disabled continue result when the critic is off', () => {
    const result = evaluateTrajectory({
      entries: [
        entry({ id: 'fail', kind: 'tool-result', summary: 'Failed', status: 'failed', transcript: 'Error: failed' }),
      ],
      settings: { ...DEFAULT_TRAJECTORY_CRITIC_SETTINGS, enabled: false },
    });

    expect(result.enabled).toBe(false);
    expect(result.action).toBe('continue');
    expect(result.score).toBe(1);
    expect(result.reasons).toEqual([]);
  });
});
