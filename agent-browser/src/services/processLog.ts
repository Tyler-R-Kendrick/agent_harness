/**
 * ProcessLog — the single canonical, append-only log of everything that
 * happened during one assistant turn. Replaces the prior split between
 * `reasoningSteps`, `voterSteps`, and `busEntries` on `ChatMessage`.
 *
 * Producers (parallel delegation, staged-tool pipeline, Codi reasoning,
 * voters, logact AgentBus) all append entries here. The UI reads only this
 * log and renders it as a minimal git-graph timeline.
 */

import type { AgentBusPayloadMeta, Entry, Payload } from 'logact';
import { PayloadType } from 'logact';

export type ProcessEntryStatus = 'active' | 'done' | 'failed';

/**
 * Open string union of entry kinds. New kinds may be added without any
 * type-system churn — the renderer falls back to a generic glyph.
 */
export type ProcessEntryKind =
  | 'stage-start'
  | 'reasoning'
  | 'tool-select'
  | 'tool-plan'
  | 'tool-created'
  | 'tool-call'
  | 'tool-result'
  | 'subagent'
  | 'handoff'
  | 'mail'
  | 'inf-in'
  | 'inf-out'
  | 'intent'
  | 'vote'
  | 'commit'
  | 'abort'
  | 'result'
  | 'completion'
  | 'policy';

export interface ProcessEntry {
  /** Stable client-side id. */
  id: string;
  /** Monotonic position assigned by the log on append (0-based). */
  position: number;
  /** Wall-clock timestamp of append (ms since epoch). */
  ts: number;
  /** Kind tag — drives the row glyph + drill-down formatting. */
  kind: ProcessEntryKind;
  /** Originating actor id (e.g. 'coordinator', 'breakdown-agent', 'voter:foo'). */
  actor: string;
  /** LogAct actor id when this row comes from a deconstructed state-machine actor. */
  actorId?: string;
  /** LogAct actor role (Driver, Voter, Decider, Executor, etc.). */
  actorRole?: string;
  /** Parent LogAct actor id for branch/lifeline rendering. */
  parentActorId?: string;
  /** Stable id of the agent responsible for this row, when known. */
  agentId?: string;
  /** Compact human label for the responsible agent. */
  agentLabel?: string;
  /** Model id used by the responsible agent, when known. */
  modelId?: string;
  /** Provider/runtime for the model, when known. */
  modelProvider?: string;
  /** Single-line human-readable summary shown in the timeline row. */
  summary: string;
  /** Full raw transcript (e.g. streamed reasoning tokens). */
  transcript?: string;
  /** Structured payload (e.g. logact Payload, tool args/result, vote data). */
  payload?: unknown;
  /** Parent entry id, if this entry is a child of another. */
  parentId?: string;
  /** Branch identifier — entries sharing a branchId render on the same rail. */
  branchId?: string;
  /** Lifecycle status. Reasoning rows stay active while tokens stream. */
  status: ProcessEntryStatus;
  /** When the entry transitioned to `done`. */
  endedAt?: number;
  /** Optional display-only timeout budget for active rows. */
  timeoutMs?: number;
}

export type ProcessLogListener = (snapshot: ProcessEntry[]) => void;

export interface ProcessLogAppendInput {
  id: string;
  kind: ProcessEntryKind;
  actor: string;
  actorId?: string;
  actorRole?: string;
  parentActorId?: string;
  agentId?: string;
  agentLabel?: string;
  modelId?: string;
  modelProvider?: string;
  summary: string;
  transcript?: string;
  payload?: unknown;
  parentId?: string;
  branchId?: string;
  status?: ProcessEntryStatus;
  ts?: number;
  timeoutMs?: number;
}

export type ProcessLogPatch = Partial<
  Pick<
    ProcessEntry,
    'summary' | 'transcript' | 'payload' | 'status' | 'endedAt' | 'timeoutMs' | 'kind'
    | 'agentId' | 'agentLabel' | 'modelId' | 'modelProvider'
    | 'actorId' | 'actorRole' | 'parentActorId'
  >
>;

/**
 * Append-only log of process entries with subscriber notifications and an
 * `update` escape hatch for in-place mutation of streaming reasoning rows.
 */
export class ProcessLog {
  private entries: ProcessEntry[] = [];
  private listeners = new Set<ProcessLogListener>();
  private nextPosition = 0;

  /** Append a new entry. Returns the assigned monotonic position. */
  append(input: ProcessLogAppendInput): ProcessEntry {
    const entry: ProcessEntry = {
      id: input.id,
      position: this.nextPosition++,
      ts: input.ts ?? Date.now(),
      kind: input.kind,
      actor: input.actor,
      ...(input.actorId !== undefined ? { actorId: input.actorId } : {}),
      ...(input.actorRole !== undefined ? { actorRole: input.actorRole } : {}),
      ...(input.parentActorId !== undefined ? { parentActorId: input.parentActorId } : {}),
      ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
      ...(input.agentLabel !== undefined ? { agentLabel: input.agentLabel } : {}),
      ...(input.modelId !== undefined ? { modelId: input.modelId } : {}),
      ...(input.modelProvider !== undefined ? { modelProvider: input.modelProvider } : {}),
      summary: input.summary,
      ...(input.transcript !== undefined ? { transcript: input.transcript } : {}),
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
      status: input.status ?? 'done',
      ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
    };
    this.entries.push(entry);
    this.notify();
    return entry;
  }

  /**
   * Mutate fields of an existing entry. Used for streaming reasoning tokens
   * and for stage-start → done transitions. Returns true on success.
   */
  update(id: string, patch: ProcessLogPatch): boolean {
    const index = this.entries.findIndex((entry) => entry.id === id);
    if (index === -1) return false;
    const next: ProcessEntry = { ...this.entries[index], ...patch };
    if ((patch.status === 'done' || patch.status === 'failed') && next.endedAt === undefined) {
      next.endedAt = Date.now();
    }
    this.entries[index] = next;
    this.notify();
    return true;
  }

  /** Returns true if an entry with the given id exists. */
  has(id: string): boolean {
    return this.entries.some((entry) => entry.id === id);
  }

  /** Snapshot of the current entries (immutable copy). */
  snapshot(): ProcessEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  /** Subscribe to log changes. Returns an unsubscribe function. */
  subscribe(listener: ProcessLogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

// ──── logact AgentBus → ProcessLog bridge ──────────────────────────────────

/**
 * Translates a single logact `Entry` into a ProcessLog append input.
 * Keeps logact's payload as the structured `payload` field for drill-down.
 */
export function entryToProcessAppend(entry: Entry): ProcessLogAppendInput {
  const { kind, actor, summary, transcript } = describePayload(entry.payload);
  const meta = actorMeta(entry.payload);
  const actorId = meta?.actorId;
  return {
    id: `bus-${entry.position}`,
    kind,
    actor: actorId ?? actor,
    ...(actorId !== undefined ? { actorId } : {}),
    ...(meta?.actorRole !== undefined ? { actorRole: meta.actorRole } : {}),
    ...(meta?.parentActorId !== undefined ? { parentActorId: meta.parentActorId } : {}),
    ...(actorId !== undefined ? { agentId: actorId } : {}),
    ...(meta?.agentLabel !== undefined ? { agentLabel: meta.agentLabel } : {}),
    ...(meta?.modelId !== undefined ? { modelId: meta.modelId } : {}),
    ...(meta?.modelProvider !== undefined ? { modelProvider: meta.modelProvider } : {}),
    summary,
    payload: entry.payload,
    ...(transcript !== undefined ? { transcript } : {}),
    ts: entry.realtimeTs,
    branchId: meta?.branchId ?? 'bus',
    status: 'done',
  };
}

function actorMeta(payload: Payload): AgentBusPayloadMeta | undefined {
  return 'meta' in payload ? payload.meta : undefined;
}

interface PayloadDescription {
  kind: ProcessEntryKind;
  actor: string;
  summary: string;
  transcript?: string;
}

function describePayload(payload: Payload): PayloadDescription {
  switch (payload.type) {
    case PayloadType.Mail:
      return {
        kind: 'mail',
        actor: payload.from,
        summary: `Mail · ${payload.from}`,
        transcript: payload.content,
      };
    case PayloadType.InfIn:
      return {
        kind: 'inf-in',
        actor: 'driver',
        summary: `InfIn · ${payload.messages.length} message${payload.messages.length === 1 ? '' : 's'}`,
        transcript: payload.messages.map((m) => `${m.role}: ${m.content}`).join('\n\n'),
      };
    case PayloadType.InfOut:
      return {
        kind: 'inf-out',
        actor: 'driver',
        summary: 'InfOut',
        transcript: payload.text,
      };
    case PayloadType.Intent:
      return {
        kind: 'intent',
        actor: 'driver',
        summary: `Intent · ${payload.intentId}`,
        transcript: payload.action,
      };
    case PayloadType.Vote:
      return {
        kind: 'vote',
        actor: `voter:${payload.voterId}`,
        summary: `Vote · ${payload.voterId} ${payload.approve ? '✓' : '✗'}`,
        transcript: payload.thought ?? payload.reason ?? (payload.approve ? 'approved' : 'rejected'),
      };
    case PayloadType.Commit:
      return {
        kind: 'commit',
        actor: 'decider',
        summary: `Commit · ${payload.intentId}`,
      };
    case PayloadType.Abort:
      return {
        kind: 'abort',
        actor: 'decider',
        summary: `Abort · ${payload.intentId}`,
        transcript: payload.reason,
      };
    case PayloadType.Result:
      return {
        kind: 'result',
        actor: 'executor',
        summary: `Result · ${payload.intentId}`,
        transcript: payload.error ? `error: ${payload.error}\n\n${payload.output}` : payload.output,
      };
    case PayloadType.Completion:
      return {
        kind: 'completion',
        actor: 'completion-checker',
        summary: `Completion · ${payload.intentId}${payload.done ? ' ✓' : ''}`,
        transcript: payload.feedback,
      };
    case PayloadType.Policy:
      return {
        kind: 'policy',
        actor: 'policy',
        summary: `Policy · ${payload.target}`,
        transcript: JSON.stringify(payload.value, null, 2),
      };
  }
}

/**
 * Mirror an existing logact Entry into the ProcessLog. Used by callers that
 * already observe AgentBus appends (`onBusEntry` callback).
 */
export function appendBusEntry(log: ProcessLog, entry: Entry): ProcessEntry {
  return log.append(entryToProcessAppend(entry));
}
