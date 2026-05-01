import { InMemoryAgentBus, PayloadType } from 'logact';
import type { AgentBusPayloadMeta, Entry, IAgentBus, Payload } from 'logact';
import { AGENT_BUS_HOOK_EVENTS, type HarnessHookRunOptions, HookRegistry } from './hooks.js';

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

export interface AgentBusHookOptions {
  hooks?: HookRegistry;
  hookOptions?: HarnessHookRunOptions;
}

export interface CreateAgentBusOptions extends AgentBusHookOptions {
  bus?: IAgentBus;
}

export function createAgentBus(options: CreateAgentBusOptions = {}): IAgentBus {
  const bus = options.bus ?? new InMemoryAgentBus();
  return options.hooks
    ? withAgentBusHooks(bus, options.hooks, options.hookOptions)
    : bus;
}

export function resolveAgentBus(bus?: IAgentBus, options: AgentBusHookOptions = {}): IAgentBus {
  const resolvedBus = bus ?? new InMemoryAgentBus();
  return options.hooks
    ? withAgentBusHooks(resolvedBus, options.hooks, options.hookOptions)
    : resolvedBus;
}

export function withAgentBusHooks(
  bus: IAgentBus,
  hooks: HookRegistry,
  hookOptions: HarnessHookRunOptions = {},
): IAgentBus {
  return new HookedAgentBus(bus, hooks, hookOptions);
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
  options: AgentBusHookOptions = {},
): Promise<number> {
  const meta: AgentBusPayloadMeta = {
    actorId: event.actorId,
    parentActorId: event.parentActorId,
    actorRole: 'chat-agent',
  };
  const targetBus = options.hooks
    ? withAgentBusHooks(bus, options.hooks, options.hookOptions)
    : bus;
  return targetBus.append({
    type: PayloadType.Policy,
    target: `harness.${event.eventType}`,
    value: event,
    meta,
  });
}

class HookedAgentBus implements IAgentBus {
  constructor(
    private readonly bus: IAgentBus,
    private readonly hooks: HookRegistry,
    private readonly hookOptions: HarnessHookRunOptions,
  ) {}

  async append(entryPayload: Payload): Promise<number> {
    const appendPayload = await runAgentBusHook(this.hooks, AGENT_BUS_HOOK_EVENTS.append, {
      entryPayload,
    }, this.hookOptions);
    const position = await this.bus.append(appendPayload.entryPayload);
    const resultPayload = await runAgentBusHook(this.hooks, AGENT_BUS_HOOK_EVENTS.appendResult, {
      entryPayload: appendPayload.entryPayload,
      position,
    }, this.hookOptions);
    return resultPayload.position;
  }

  async read(start: number, end: number): Promise<Entry[]> {
    const readPayload = await runAgentBusHook(this.hooks, AGENT_BUS_HOOK_EVENTS.read, {
      start,
      end,
    }, this.hookOptions);
    const entries = await this.bus.read(readPayload.start, readPayload.end);
    const resultPayload = await runAgentBusHook(this.hooks, AGENT_BUS_HOOK_EVENTS.readResult, {
      start: readPayload.start,
      end: readPayload.end,
      entries,
    }, this.hookOptions);
    return resultPayload.entries;
  }

  async tail(): Promise<number> {
    await runAgentBusHook(this.hooks, AGENT_BUS_HOOK_EVENTS.tail, {}, this.hookOptions);
    const position = await this.bus.tail();
    const resultPayload = await runAgentBusHook(this.hooks, AGENT_BUS_HOOK_EVENTS.tailResult, {
      position,
    }, this.hookOptions);
    return resultPayload.position;
  }

  async poll(start: number, filter: PayloadType[]): Promise<Entry[]> {
    const pollPayload = await runAgentBusHook(this.hooks, AGENT_BUS_HOOK_EVENTS.poll, {
      start,
      filter,
    }, this.hookOptions);
    const entries = await this.bus.poll(pollPayload.start, pollPayload.filter);
    const resultPayload = await runAgentBusHook(this.hooks, AGENT_BUS_HOOK_EVENTS.pollResult, {
      start: pollPayload.start,
      filter: pollPayload.filter,
      entries,
    }, this.hookOptions);
    return resultPayload.entries;
  }
}

async function runAgentBusHook<TPayload>(
  hooks: HookRegistry,
  event: Parameters<HookRegistry['runEvent']>[0],
  payload: TPayload,
  options: HarnessHookRunOptions,
): Promise<TPayload> {
  return (await hooks.runEvent(event, payload, options)).payload;
}
