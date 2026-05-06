import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCHEDULED_AUTOMATION_STATE,
  buildScheduledAutomationInbox,
  isScheduledAutomationState,
  projectDueScheduledAutomations,
  recordScheduledAutomationRun,
} from './scheduledAutomations';

describe('scheduledAutomations', () => {
  it('projects only enabled schedules due at or before the current time', () => {
    const due = projectDueScheduledAutomations({
      state: DEFAULT_SCHEDULED_AUTOMATION_STATE,
      now: new Date('2026-05-06T18:00:00.000Z'),
    });

    expect(due.map((automation) => automation.id)).toContain('daily-workspace-audit');
    expect(due.map((automation) => automation.id)).not.toContain('weekly-verification-sweep');
    expect(due.every((automation) => automation.enabled)).toBe(true);
  });

  it('records run evidence, advances recurring schedules, and creates review inbox entries', () => {
    const next = recordScheduledAutomationRun({
      state: DEFAULT_SCHEDULED_AUTOMATION_STATE,
      automationId: 'daily-workspace-audit',
      now: new Date('2026-05-06T18:00:00.000Z'),
      run: {
        status: 'failed',
        summary: 'Workspace audit found stale browser evidence.',
        evidence: ['visual smoke stale'],
        requiresReview: true,
      },
    });

    expect(next.runs[0]).toMatchObject({
      automationId: 'daily-workspace-audit',
      status: 'failed',
      attempt: 1,
      requiresReview: true,
    });
    expect(next.automations.find((entry) => entry.id === 'daily-workspace-audit')?.nextRunAt).toBe('2026-05-07T18:00:00.000Z');
    expect(buildScheduledAutomationInbox(next)[0]?.title).toBe('Daily workspace audit needs review');
  });

  it('supports one-off schedules by disabling them after the first recorded run', () => {
    const state = {
      ...DEFAULT_SCHEDULED_AUTOMATION_STATE,
      automations: [{
        ...DEFAULT_SCHEDULED_AUTOMATION_STATE.automations[0],
        id: 'one-shot',
        title: 'One-shot verification',
        cadence: 'once' as const,
        nextRunAt: '2026-05-06T18:00:00.000Z',
      }],
      runs: [],
      inbox: [],
    };

    const next = recordScheduledAutomationRun({
      state,
      automationId: 'one-shot',
      now: new Date('2026-05-06T18:00:00.000Z'),
      run: {
        status: 'passed',
        summary: 'Completed once.',
        evidence: ['passed'],
        requiresReview: false,
      },
    });

    expect(next.automations[0]).toMatchObject({
      enabled: false,
      nextRunAt: null,
    });
  });

  it('accepts only valid persisted scheduler state', () => {
    expect(isScheduledAutomationState(DEFAULT_SCHEDULED_AUTOMATION_STATE)).toBe(true);
    expect(isScheduledAutomationState({ automations: [{ cadence: 'sometimes' }], runs: [], inbox: [] })).toBe(false);
    expect(isScheduledAutomationState({ automations: [], runs: 'bad', inbox: [] })).toBe(false);
  });
});
