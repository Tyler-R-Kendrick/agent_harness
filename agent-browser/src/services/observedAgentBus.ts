/**
 * services/observedAgentBus.ts
 *
 * Shared `InMemoryAgentBus` wrapper that mirrors every appended LogAct entry
 * to a caller-supplied `onBusEntry` callback. Used by every code path that
 * runs through `runAgentLoop` (parallel delegation, staged tool pipeline,
 * local ReAct executor) so the same Mail/InfIn/InfOut/Intent/Vote/Commit/
 * Result/Completion telemetry surfaces in the ProcessLog.
 */

import { InMemoryAgentBus, PayloadType } from 'logact';
import type { Entry, Payload } from 'logact';
import type { BusEntryStep } from '../types';

export function summarisePayload(payload: Payload): { summary: string; detail: string; actor?: string } {
  switch (payload.type) {
    case PayloadType.Mail:
      return { summary: `Mail · ${payload.from}`, detail: payload.content, actor: payload.from };
    case PayloadType.InfIn:
      return {
        summary: `InfIn · ${payload.messages.length} message(s)`,
        detail: payload.messages.map((m) => `${m.role}: ${m.content}`).join('\n\n'),
      };
    case PayloadType.InfOut:
      return { summary: 'InfOut', detail: payload.text };
    case PayloadType.Intent:
      return { summary: `Intent · ${payload.intentId}`, detail: payload.action };
    case PayloadType.Vote:
      return {
        summary: `Vote · ${payload.voterId} ${payload.approve ? '✓' : '✗'}`,
        detail: payload.thought ?? payload.reason ?? (payload.approve ? 'approved' : 'rejected'),
        actor: payload.voterId,
      };
    case PayloadType.Commit:
      return { summary: `Commit · ${payload.intentId}`, detail: 'intent committed' };
    case PayloadType.Abort:
      return { summary: `Abort · ${payload.intentId}`, detail: payload.reason ?? 'intent aborted' };
    case PayloadType.Result:
      return {
        summary: `Result · ${payload.intentId}`,
        detail: payload.error ? `error: ${payload.error}\n\n${payload.output}` : payload.output,
      };
    case PayloadType.Completion:
      return {
        summary: `Completion · ${payload.intentId}${payload.done ? ' ✓' : ''}`,
        detail: payload.feedback ?? (payload.done ? 'task complete' : 'task incomplete'),
      };
    case PayloadType.Policy:
      return { summary: `Policy · ${payload.target}`, detail: JSON.stringify(payload.value) };
  }
}

export function entryToBusStep(entry: Entry): BusEntryStep {
  const { summary, detail, actor } = summarisePayload(entry.payload);
  return {
    id: `bus-${entry.position}`,
    position: entry.position,
    realtimeTs: entry.realtimeTs,
    payloadType: String(entry.payload.type),
    summary,
    detail,
    ...(actor ? { actor } : {}),
  };
}

/**
 * Wraps an `InMemoryAgentBus` so every appended entry is mirrored to the
 * caller through `onBusEntry`. The wrapper still satisfies `IAgentBus` so it
 * can be passed to `runAgentLoop`.
 */
export function createObservedBus(onBusEntry: ((entry: BusEntryStep) => void) | undefined): InMemoryAgentBus {
  const bus = new InMemoryAgentBus();
  if (!onBusEntry) return bus;
  const originalAppend = bus.append.bind(bus);
  bus.append = async (payload: Payload) => {
    const position = await originalAppend(payload);
    onBusEntry(entryToBusStep({ position, realtimeTs: Date.now(), payload }));
    return position;
  };
  return bus;
}
