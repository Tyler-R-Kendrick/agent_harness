import { InMemoryAgentBus, PayloadType } from 'logact';
import type { AgentBusPayloadMeta, Entry, IAgentBus } from 'logact';

export type AgentBusEntrySnapshot = Entry & {
  index: number;
};

export interface AgentBusEvent<TData = unknown> {
  eventType: string;
  actorId: string;
  parentActorId?: string;
  instructions?: string;
  data?: TData;
}

export function createAgentBus(): IAgentBus {
  return new InMemoryAgentBus();
}

export function resolveAgentBus(bus?: IAgentBus): IAgentBus {
  return bus ?? createAgentBus();
}

export async function readAgentBusEntries(bus: IAgentBus, start = 0, end?: number): Promise<AgentBusEntrySnapshot[]> {
  const tail = end ?? await bus.tail();
  const entries = await bus.read(start, tail);
  return entries.map((entry) => ({
    ...entry,
    index: entry.position,
  }));
}

export async function appendAgentEvent<TData>(
  bus: IAgentBus,
  event: AgentBusEvent<TData>,
): Promise<number> {
  const meta: AgentBusPayloadMeta = {
    actorId: event.actorId,
    parentActorId: event.parentActorId,
    actorRole: 'chat-agent',
  };
  return bus.append({
    type: PayloadType.Policy,
    target: `harness.${event.eventType}`,
    value: event,
    meta,
  });
}
