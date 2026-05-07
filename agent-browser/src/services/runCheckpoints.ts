import type { ProcessEntry } from './processLog';

export type RunCheckpointReason = 'approval' | 'credentials' | 'delayed-input';
export type RunCheckpointStatus = 'suspended' | 'resumed' | 'expired' | 'canceled';
export type RunCheckpointAuditAction = 'suspended' | 'resumed' | 'expired' | 'canceled';

export interface RunCheckpointPolicy {
  defaultTimeoutMinutes: number;
  requireOperatorConfirmation: boolean;
  preserveArtifacts: boolean;
}

export interface RunCheckpoint {
  id: string;
  sessionId: string;
  workspaceId: string;
  reason: RunCheckpointReason;
  status: RunCheckpointStatus;
  summary: string;
  boundary: string;
  requiredInput: string;
  resumeToken: string;
  artifacts: string[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  resumedAt?: string;
  resumeEvidence?: string;
}

export interface RunCheckpointAuditEntry {
  id: string;
  checkpointId: string;
  action: RunCheckpointAuditAction;
  actor: string;
  summary: string;
  createdAt: string;
}

export interface RunCheckpointState {
  checkpoints: RunCheckpoint[];
  audit: RunCheckpointAuditEntry[];
  policy: RunCheckpointPolicy;
}

export interface CreateRunCheckpointInput {
  sessionId: string;
  workspaceId: string;
  reason: RunCheckpointReason;
  summary: string;
  boundary: string;
  requiredInput: string;
  artifacts?: string[];
  now?: Date;
  timeoutMinutes?: number;
}

export interface ResumeRunCheckpointInput {
  actor: string;
  evidence: string;
  now?: Date;
}

export const DEFAULT_RUN_CHECKPOINT_POLICY: RunCheckpointPolicy = {
  defaultTimeoutMinutes: 240,
  requireOperatorConfirmation: true,
  preserveArtifacts: true,
};

export const DEFAULT_RUN_CHECKPOINT_STATE: RunCheckpointState = {
  checkpoints: [
    {
      id: 'checkpoint:visual-eval-session:2026-05-07T02:30:00.000Z',
      sessionId: 'visual-eval-session',
      workspaceId: 'ws-research',
      reason: 'approval',
      status: 'suspended',
      summary: 'Approval before deployment',
      boundary: 'before deploy tool call',
      requiredInput: 'operator approval',
      resumeToken: 'resume:visual-eval-session:2026-05-07T02:30:00.000Z',
      artifacts: ['agent-browser-visual-smoke.png'],
      createdAt: '2026-05-07T02:30:00.000Z',
      updatedAt: '2026-05-07T02:30:00.000Z',
      expiresAt: '2026-05-07T06:30:00.000Z',
    },
  ],
  audit: [
    {
      id: 'audit:checkpoint:visual-eval-session:2026-05-07T02:30:00.000Z:suspended',
      checkpointId: 'checkpoint:visual-eval-session:2026-05-07T02:30:00.000Z',
      action: 'suspended',
      actor: 'agent-browser',
      summary: 'Suspended at before deploy tool call',
      createdAt: '2026-05-07T02:30:00.000Z',
    },
  ],
  policy: DEFAULT_RUN_CHECKPOINT_POLICY,
};

const REASONS: RunCheckpointReason[] = ['approval', 'credentials', 'delayed-input'];
const STATUSES: RunCheckpointStatus[] = ['suspended', 'resumed', 'expired', 'canceled'];
const AUDIT_ACTIONS: RunCheckpointAuditAction[] = ['suspended', 'resumed', 'expired', 'canceled'];

export function createRunCheckpoint(
  state: RunCheckpointState,
  input: CreateRunCheckpointInput,
): RunCheckpointState {
  const now = input.now ?? new Date();
  const createdAt = safeIso(now);
  const timeoutMinutes = input.timeoutMinutes ?? state.policy.defaultTimeoutMinutes;
  const expiresAt = new Date(safeTime(now) + timeoutMinutes * 60_000).toISOString();
  const checkpoint: RunCheckpoint = {
    id: `checkpoint:${input.sessionId}:${createdAt}`,
    sessionId: input.sessionId,
    workspaceId: input.workspaceId,
    reason: input.reason,
    status: 'suspended',
    summary: input.summary,
    boundary: input.boundary,
    requiredInput: input.requiredInput,
    resumeToken: `resume:${input.sessionId}:${createdAt}`,
    artifacts: [...(input.artifacts ?? [])],
    createdAt,
    updatedAt: createdAt,
    expiresAt,
  };

  return {
    ...state,
    checkpoints: [checkpoint, ...state.checkpoints],
    audit: [
      buildAuditEntry(checkpoint, 'suspended', 'agent-browser', `Suspended at ${checkpoint.boundary}`, createdAt),
      ...state.audit,
    ],
  };
}

export function resumeRunCheckpoint(
  state: RunCheckpointState,
  checkpointId: string,
  input: ResumeRunCheckpointInput,
): RunCheckpointState {
  const now = input.now ?? new Date();
  const updatedAt = safeIso(now);
  const checkpoint = state.checkpoints.find((entry) => entry.id === checkpointId);
  if (!checkpoint || (checkpoint.status !== 'suspended' && checkpoint.status !== 'expired')) {
    return cloneState(state);
  }

  const updated: RunCheckpoint = {
    ...checkpoint,
    status: 'resumed',
    updatedAt,
    resumedAt: updatedAt,
    resumeEvidence: input.evidence,
  };

  return {
    ...state,
    checkpoints: state.checkpoints.map((entry) => (entry.id === checkpointId ? updated : { ...entry, artifacts: [...entry.artifacts] })),
    audit: [
      buildAuditEntry(updated, 'resumed', input.actor, `Resumed with evidence: ${input.evidence}`, updatedAt),
      ...state.audit,
    ],
  };
}

export function expireDueRunCheckpoints(state: RunCheckpointState, now = new Date()): RunCheckpointState {
  const nowMs = safeTime(now);
  const updatedAt = safeIso(now);
  const expired: RunCheckpoint[] = [];
  const checkpoints = state.checkpoints.map((checkpoint) => {
    if (checkpoint.status !== 'suspended') return { ...checkpoint, artifacts: [...checkpoint.artifacts] };
    const expiresAtMs = Date.parse(checkpoint.expiresAt);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs > nowMs) {
      return { ...checkpoint, artifacts: [...checkpoint.artifacts] };
    }
    const next = { ...checkpoint, status: 'expired' as const, updatedAt };
    expired.push(next);
    return next;
  });
  if (!expired.length) {
    return { ...state, checkpoints, audit: state.audit.map((entry) => ({ ...entry })), policy: { ...state.policy } };
  }

  return {
    ...state,
    checkpoints,
    audit: [
      ...expired.map((checkpoint) => buildAuditEntry(
        checkpoint,
        'expired',
        'agent-browser',
        `Checkpoint timed out after ${elapsedMinutes(checkpoint.createdAt, checkpoint.expiresAt)} minutes`,
        updatedAt,
      )),
      ...state.audit,
    ],
  };
}

export function updateRunCheckpointPolicy(
  state: RunCheckpointState,
  patch: Partial<RunCheckpointPolicy>,
): RunCheckpointState {
  return {
    ...cloneState(state),
    policy: {
      ...state.policy,
      ...patch,
    },
  };
}

export function buildCheckpointProcessEntry(checkpoint: RunCheckpoint, position: number): ProcessEntry {
  const timeoutMs = Math.max(1, Date.parse(checkpoint.expiresAt) - Date.parse(checkpoint.createdAt));
  return {
    id: checkpoint.id,
    position,
    ts: Date.parse(checkpoint.createdAt),
    kind: 'handoff',
    actor: 'checkpoint',
    summary: checkpoint.summary,
    transcript: `Suspended at ${checkpoint.boundary}\nRequired input: ${checkpoint.requiredInput}`,
    payload: { checkpoint },
    branchId: `checkpoint:${checkpoint.sessionId}`,
    status: checkpoint.status === 'suspended' ? 'active' : 'done',
    timeoutMs,
    ...(checkpoint.status !== 'suspended' ? { endedAt: Date.parse(checkpoint.updatedAt) } : {}),
  };
}

export function buildCheckpointPromptContext(state: RunCheckpointState, workspaceId: string): string {
  const suspended = state.checkpoints.filter((checkpoint) => (
    checkpoint.workspaceId === workspaceId && checkpoint.status === 'suspended'
  ));
  if (!suspended.length) return '';
  return [
    `Run checkpoints: ${suspended.length} suspended`,
    ...suspended.map((checkpoint) => [
      `- ${checkpoint.summary}`,
      `  session: ${checkpoint.sessionId}`,
      `  reason: ${checkpoint.reason}`,
      `  boundary: ${checkpoint.boundary}`,
      `  required input: ${checkpoint.requiredInput}`,
      `  resume token: ${checkpoint.resumeToken}`,
    ].join('\n')),
  ].join('\n');
}

export function isRunCheckpointState(value: unknown): value is RunCheckpointState {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.checkpoints)
    && value.checkpoints.every(isRunCheckpoint)
    && Array.isArray(value.audit)
    && value.audit.every(isRunCheckpointAuditEntry)
    && isRunCheckpointPolicy(value.policy)
  );
}

function buildAuditEntry(
  checkpoint: RunCheckpoint,
  action: RunCheckpointAuditAction,
  actor: string,
  summary: string,
  createdAt: string,
): RunCheckpointAuditEntry {
  return {
    id: `audit:${checkpoint.id}:${action}:${createdAt}`,
    checkpointId: checkpoint.id,
    action,
    actor,
    summary,
    createdAt,
  };
}

function cloneState(state: RunCheckpointState): RunCheckpointState {
  return {
    checkpoints: state.checkpoints.map((checkpoint) => ({ ...checkpoint, artifacts: [...checkpoint.artifacts] })),
    audit: state.audit.map((entry) => ({ ...entry })),
    policy: { ...state.policy },
  };
}

function isRunCheckpoint(value: unknown): value is RunCheckpoint {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id)
    && isNonEmptyString(value.sessionId)
    && isNonEmptyString(value.workspaceId)
    && typeof value.reason === 'string'
    && (REASONS as string[]).includes(value.reason)
    && typeof value.status === 'string'
    && (STATUSES as string[]).includes(value.status)
    && isNonEmptyString(value.summary)
    && isNonEmptyString(value.boundary)
    && isNonEmptyString(value.requiredInput)
    && isNonEmptyString(value.resumeToken)
    && Array.isArray(value.artifacts)
    && value.artifacts.every((entry) => typeof entry === 'string')
    && isIsoDateString(value.createdAt)
    && isIsoDateString(value.updatedAt)
    && isIsoDateString(value.expiresAt)
    && (value.resumedAt === undefined || isIsoDateString(value.resumedAt))
    && (value.resumeEvidence === undefined || typeof value.resumeEvidence === 'string')
  );
}

function isRunCheckpointAuditEntry(value: unknown): value is RunCheckpointAuditEntry {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id)
    && isNonEmptyString(value.checkpointId)
    && typeof value.action === 'string'
    && (AUDIT_ACTIONS as string[]).includes(value.action)
    && isNonEmptyString(value.actor)
    && isNonEmptyString(value.summary)
    && isIsoDateString(value.createdAt)
  );
}

function isRunCheckpointPolicy(value: unknown): value is RunCheckpointPolicy {
  if (!isRecord(value)) return false;
  return (
    typeof value.defaultTimeoutMinutes === 'number'
    && Number.isInteger(value.defaultTimeoutMinutes)
    && value.defaultTimeoutMinutes >= 5
    && value.defaultTimeoutMinutes <= 10_080
    && typeof value.requireOperatorConfirmation === 'boolean'
    && typeof value.preserveArtifacts === 'boolean'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function safeIso(date: Date): string {
  return new Date(safeTime(date)).toISOString();
}

function safeTime(date: Date): number {
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function elapsedMinutes(start: string, end: string): number {
  return Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 60_000));
}
