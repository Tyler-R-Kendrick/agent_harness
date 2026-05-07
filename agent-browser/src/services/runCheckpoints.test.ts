import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RUN_CHECKPOINT_STATE,
  buildCheckpointProcessEntry,
  buildCheckpointPromptContext,
  createRunCheckpoint,
  expireDueRunCheckpoints,
  isRunCheckpointState,
  resumeRunCheckpoint,
  updateRunCheckpointPolicy,
} from './runCheckpoints';

const EMPTY_RUN_CHECKPOINT_STATE = {
  ...DEFAULT_RUN_CHECKPOINT_STATE,
  checkpoints: [],
  audit: [],
};

describe('run checkpoints', () => {
  it('creates resumable approval checkpoints with audit and process metadata', () => {
    const state = createRunCheckpoint(EMPTY_RUN_CHECKPOINT_STATE, {
      sessionId: 'session-1',
      workspaceId: 'ws-research',
      reason: 'approval',
      summary: 'Approval before deployment',
      boundary: 'before deploy tool call',
      requiredInput: 'human approval',
      artifacts: ['plan.md', 'screenshot.png'],
      now: new Date('2026-05-07T03:00:00.000Z'),
    });

    expect(state.checkpoints).toHaveLength(1);
    expect(state.checkpoints[0]).toMatchObject({
      id: 'checkpoint:session-1:2026-05-07T03:00:00.000Z',
      sessionId: 'session-1',
      workspaceId: 'ws-research',
      reason: 'approval',
      summary: 'Approval before deployment',
      boundary: 'before deploy tool call',
      requiredInput: 'human approval',
      status: 'suspended',
      artifacts: ['plan.md', 'screenshot.png'],
      createdAt: '2026-05-07T03:00:00.000Z',
      updatedAt: '2026-05-07T03:00:00.000Z',
      expiresAt: '2026-05-07T07:00:00.000Z',
    });
    expect(state.checkpoints[0].resumeToken).toBe('resume:session-1:2026-05-07T03:00:00.000Z');
    expect(state.audit[0]).toMatchObject({
      checkpointId: state.checkpoints[0].id,
      action: 'suspended',
      actor: 'agent-browser',
      summary: 'Suspended at before deploy tool call',
    });

    const processEntry = buildCheckpointProcessEntry(state.checkpoints[0], 4);
    expect(processEntry).toMatchObject({
      id: 'checkpoint:session-1:2026-05-07T03:00:00.000Z',
      position: 4,
      kind: 'handoff',
      actor: 'checkpoint',
      summary: 'Approval before deployment',
      branchId: 'checkpoint:session-1',
      status: 'active',
      timeoutMs: 14_400_000,
    });
  });

  it('resumes suspended checkpoints while preserving an audit trail', () => {
    const suspended = createRunCheckpoint(EMPTY_RUN_CHECKPOINT_STATE, {
      sessionId: 'session-1',
      workspaceId: 'ws-research',
      reason: 'credentials',
      summary: 'Waiting for deploy token',
      boundary: 'credential lookup',
      requiredInput: 'secret reference',
      now: new Date('2026-05-07T03:00:00.000Z'),
    });

    const resumed = resumeRunCheckpoint(suspended, suspended.checkpoints[0].id, {
      actor: 'operator',
      evidence: 'Added secret://deploy-token',
      now: new Date('2026-05-07T03:15:00.000Z'),
    });

    expect(resumed.checkpoints[0]).toMatchObject({
      status: 'resumed',
      resumedAt: '2026-05-07T03:15:00.000Z',
      updatedAt: '2026-05-07T03:15:00.000Z',
      resumeEvidence: 'Added secret://deploy-token',
    });
    expect(resumed.audit.map((entry) => entry.action)).toEqual(['resumed', 'suspended']);
    expect(resumed.audit[0]).toMatchObject({
      actor: 'operator',
      summary: 'Resumed with evidence: Added secret://deploy-token',
    });
  });

  it('expires due suspended checkpoints without mutating future or completed ones', () => {
    const first = createRunCheckpoint(EMPTY_RUN_CHECKPOINT_STATE, {
      sessionId: 'old-session',
      workspaceId: 'ws-research',
      reason: 'delayed-input',
      summary: 'Waiting for user reply',
      boundary: 'elicitation',
      requiredInput: 'shipping address',
      now: new Date('2026-05-07T00:00:00.000Z'),
    });
    const second = createRunCheckpoint(first, {
      sessionId: 'new-session',
      workspaceId: 'ws-research',
      reason: 'approval',
      summary: 'Waiting for approval',
      boundary: 'tool gate',
      requiredInput: 'approve write',
      now: new Date('2026-05-07T06:00:00.000Z'),
    });

    const expired = expireDueRunCheckpoints(second, new Date('2026-05-07T04:30:00.000Z'));

    expect(expired.checkpoints.find((entry) => entry.sessionId === 'old-session')?.status).toBe('expired');
    expect(expired.checkpoints.find((entry) => entry.sessionId === 'new-session')?.status).toBe('suspended');
    expect(expired.audit[0]).toMatchObject({
      action: 'expired',
      summary: 'Checkpoint timed out after 240 minutes',
    });
  });

  it('builds prompt context only for suspended checkpoints', () => {
    const state = createRunCheckpoint(EMPTY_RUN_CHECKPOINT_STATE, {
      sessionId: 'session-1',
      workspaceId: 'ws-research',
      reason: 'approval',
      summary: 'Approval before deployment',
      boundary: 'before deploy tool call',
      requiredInput: 'human approval',
      now: new Date('2026-05-07T03:00:00.000Z'),
    });

    const context = buildCheckpointPromptContext(state, 'ws-research');

    expect(context).toContain('Run checkpoints: 1 suspended');
    expect(context).toContain('Approval before deployment');
    expect(context).toContain('resume:session-1:2026-05-07T03:00:00.000Z');
  });

  it('validates checkpoint state and rejects malformed storage payloads', () => {
    const state = createRunCheckpoint(EMPTY_RUN_CHECKPOINT_STATE, {
      sessionId: 'session-1',
      workspaceId: 'ws-research',
      reason: 'approval',
      summary: 'Approval before deployment',
      boundary: 'before deploy tool call',
      requiredInput: 'human approval',
      now: new Date('2026-05-07T03:00:00.000Z'),
    });

    expect(isRunCheckpointState(state)).toBe(true);
    expect(isRunCheckpointState({ ...state, policy: { defaultTimeoutMinutes: -1 } })).toBe(false);
    expect(isRunCheckpointState({ ...state, checkpoints: [{ ...state.checkpoints[0], status: 'paused' }] })).toBe(false);
  });

  it('updates checkpoint policy without dropping existing checkpoints', () => {
    const state = createRunCheckpoint(EMPTY_RUN_CHECKPOINT_STATE, {
      sessionId: 'session-1',
      workspaceId: 'ws-research',
      reason: 'approval',
      summary: 'Approval before deployment',
      boundary: 'before deploy tool call',
      requiredInput: 'human approval',
      now: new Date('2026-05-07T03:00:00.000Z'),
    });

    const updated = updateRunCheckpointPolicy(state, {
      defaultTimeoutMinutes: 90,
      requireOperatorConfirmation: false,
    });

    expect(updated.checkpoints).toEqual(state.checkpoints);
    expect(updated.policy).toMatchObject({
      defaultTimeoutMinutes: 90,
      requireOperatorConfirmation: false,
      preserveArtifacts: true,
    });
  });
});
