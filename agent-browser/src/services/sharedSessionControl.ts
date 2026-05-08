export type SharedSessionControlStatus = 'pairing-pending' | 'active' | 'ended';
export type SharedSessionControlEvent =
  | 'session.opened'
  | 'pairing.confirmed'
  | 'message.created'
  | 'remote-control.requested'
  | 'session.ended';

export interface SharedSessionSummary {
  sessionId: string;
  workspaceName: string;
  peerLabel: string;
  deviceLabel: string;
  status: SharedSessionControlStatus;
  eventCount: number;
  lastEventAt: string;
}

export interface SharedSessionAuditEntry {
  id: string;
  sessionId: string;
  event: SharedSessionControlEvent;
  actor: string;
  summary: string;
  createdAt: string;
}

export interface SharedSessionControlState {
  enabled: boolean;
  allowRemoteControl: boolean;
  requirePairingConfirmation: boolean;
  activeSessions: SharedSessionSummary[];
  audit: SharedSessionAuditEntry[];
}

export interface SharedSessionControlEventInput {
  sessionId: string;
  workspaceName: string;
  event: SharedSessionControlEvent;
  actor: string;
  peerLabel?: string | null;
  deviceLabel?: string | null;
  createdAt?: string | Date;
}

export interface SharedSessionPeerMessageInput {
  text: string;
  peerLabel?: string | null;
  deviceLabel?: string | null;
}

const MAX_AUDIT_ENTRIES = 50;
const SHARED_SESSION_CONTROL_STATUSES: SharedSessionControlStatus[] = ['pairing-pending', 'active', 'ended'];
const SHARED_SESSION_CONTROL_EVENTS: SharedSessionControlEvent[] = [
  'session.opened',
  'pairing.confirmed',
  'message.created',
  'remote-control.requested',
  'session.ended',
];

export const DEFAULT_SHARED_SESSION_CONTROL_STATE: SharedSessionControlState = {
  enabled: true,
  allowRemoteControl: true,
  requirePairingConfirmation: true,
  activeSessions: [],
  audit: [],
};

export function isSharedSessionControlState(value: unknown): value is SharedSessionControlState {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && typeof value.allowRemoteControl === 'boolean'
    && typeof value.requirePairingConfirmation === 'boolean'
    && Array.isArray(value.activeSessions)
    && value.activeSessions.every(isSharedSessionSummary)
    && Array.isArray(value.audit)
    && value.audit.every(isSharedSessionAuditEntry)
  );
}

export function recordSharedSessionControlEvent(
  state: SharedSessionControlState,
  input: SharedSessionControlEventInput,
): SharedSessionControlState {
  const createdAt = toIsoString(input.createdAt);
  const peerLabel = cleanLabel(input.peerLabel, 'Peer user');
  const deviceLabel = cleanLabel(input.deviceLabel, 'Remote device');
  const existing = state.activeSessions.find((session) => session.sessionId === input.sessionId);
  const nextSummary: SharedSessionSummary = {
    sessionId: input.sessionId,
    workspaceName: input.workspaceName,
    peerLabel,
    deviceLabel,
    status: getStatusForEvent(input.event),
    eventCount: (existing?.eventCount ?? 0) + 1,
    lastEventAt: createdAt,
  };
  const activeSessions = [
    nextSummary,
    ...state.activeSessions.filter((session) => session.sessionId !== input.sessionId),
  ];
  const auditEntry: SharedSessionAuditEntry = {
    id: `${input.sessionId}:${input.event}:${createdAt}`,
    sessionId: input.sessionId,
    event: input.event,
    actor: cleanLabel(input.actor, peerLabel),
    summary: summarizeEvent(input.event, cleanLabel(input.actor, peerLabel), peerLabel, deviceLabel),
    createdAt,
  };

  return {
    ...state,
    activeSessions,
    audit: [auditEntry, ...state.audit].slice(0, MAX_AUDIT_ENTRIES),
  };
}

export function formatSharedSessionPeerMessage(input: SharedSessionPeerMessageInput): string {
  const peerLabel = cleanLabel(input.peerLabel, 'Peer user');
  const deviceLabel = cleanLabel(input.deviceLabel, 'Remote device');
  return `Shared from ${peerLabel} (${deviceLabel}):\n${input.text.trim()}`;
}

export function buildSharedSessionControlPromptContext(
  state: SharedSessionControlState,
  sessionId: string,
): string {
  if (!state.enabled) return '';
  const session = state.activeSessions.find((entry) => entry.sessionId === sessionId && entry.status === 'active');
  if (!session) return '';
  return [
    'Shared session remote control:',
    `- Workspace: ${session.workspaceName}`,
    `- Peer: ${session.peerLabel}`,
    `- Device: ${session.deviceLabel}`,
    `- Remote control: ${state.allowRemoteControl ? 'enabled' : 'disabled'}`,
    `- Pairing confirmation: ${state.requirePairingConfirmation ? 'required' : 'optional'}`,
    `- Signed shared events observed: ${session.eventCount}`,
  ].join('\n');
}

function isSharedSessionSummary(value: unknown): value is SharedSessionSummary {
  if (!isRecord(value)) return false;
  return (
    typeof value.sessionId === 'string'
    && typeof value.workspaceName === 'string'
    && typeof value.peerLabel === 'string'
    && typeof value.deviceLabel === 'string'
    && typeof value.eventCount === 'number'
    && Number.isInteger(value.eventCount)
    && value.eventCount >= 0
    && typeof value.lastEventAt === 'string'
    && SHARED_SESSION_CONTROL_STATUSES.includes(value.status as SharedSessionControlStatus)
  );
}

function isSharedSessionAuditEntry(value: unknown): value is SharedSessionAuditEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.sessionId === 'string'
    && SHARED_SESSION_CONTROL_EVENTS.includes(value.event as SharedSessionControlEvent)
    && typeof value.actor === 'string'
    && typeof value.summary === 'string'
    && typeof value.createdAt === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getStatusForEvent(event: SharedSessionControlEvent): SharedSessionControlStatus {
  if (event === 'session.ended') return 'ended';
  if (event === 'session.opened') return 'pairing-pending';
  return 'active';
}

function summarizeEvent(
  event: SharedSessionControlEvent,
  actor: string,
  peerLabel: string,
  deviceLabel: string,
): string {
  if (event === 'session.opened') return `${actor} opened a shared session for ${peerLabel} on ${deviceLabel}.`;
  if (event === 'pairing.confirmed') return `${actor} confirmed pairing for ${peerLabel} on ${deviceLabel}.`;
  if (event === 'message.created') return `${actor} posted a shared-session message from ${deviceLabel}.`;
  if (event === 'remote-control.requested') return `${actor} requested remote control from ${deviceLabel}.`;
  return `${actor} ended the shared session with ${peerLabel} on ${deviceLabel}.`;
}

function cleanLabel(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 80);
}

function toIsoString(value: string | Date | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return value;
  return new Date().toISOString();
}
