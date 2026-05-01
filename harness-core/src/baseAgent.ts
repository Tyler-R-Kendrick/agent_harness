import type { IAgentBus } from 'logact';
import { appendAgentEvent, resolveAgentBus } from './agentBus.js';
import { runActorWorkflow } from './actorWorkflow.js';
import { ArtifactRegistry } from './artifacts.js';
import { CommandRegistry } from './commands.js';
import { createDefaultCommandRegistry } from './defaultCommands.js';
import { HookRegistry } from './hooks.js';
import { MemoryRegistry, type MemoryMessage } from './memory.js';
import { type HarnessStorage, type HarnessStorageSource, resolveHarnessStorage } from './storage.js';
import { ToolRegistry } from './tools.js';

export interface BaseAgentDefinition<
  TInput,
  TOutput,
  TMessage extends MemoryMessage = MemoryMessage,
  THookPayload = unknown,
> {
  id: string;
  instructions: string;
  run: (input: TInput, context: BaseAgentContext<TMessage, THookPayload>) => Promise<TOutput> | TOutput;
}

export interface BaseAgentComponents<
  TMessage extends MemoryMessage = MemoryMessage,
  THookPayload = unknown,
> {
  bus: IAgentBus;
  hooks: HookRegistry<THookPayload>;
  memory: MemoryRegistry<TMessage>;
  tools: ToolRegistry;
  commands: CommandRegistry;
  storage: HarnessStorage;
  artifacts: ArtifactRegistry;
}

export interface BaseAgentContext<
  TMessage extends MemoryMessage = MemoryMessage,
  THookPayload = unknown,
> extends BaseAgentComponents<TMessage, THookPayload> {
  agentId: string;
  parentActorId?: string;
  instructions: string;
  signal?: AbortSignal;
  runSubagent: <TSubInput, TSubOutput>(
    agent: BaseAgentDefinition<TSubInput, TSubOutput, TMessage, THookPayload>,
    input: TSubInput,
  ) => Promise<TSubOutput>;
}

export interface CreateAgentRuntimeOptions<
  TInput,
  TOutput,
  TMessage extends MemoryMessage = MemoryMessage,
  THookPayload = unknown,
> extends Omit<Partial<BaseAgentComponents<TMessage, THookPayload>>, 'storage'> {
  agent: BaseAgentDefinition<TInput, TOutput, TMessage, THookPayload>;
  storage?: HarnessStorageSource;
}

export interface AgentRuntime<
  TInput,
  TOutput,
  TMessage extends MemoryMessage = MemoryMessage,
  THookPayload = unknown,
> {
  id: string;
  instructions: string;
  components: BaseAgentComponents<TMessage, THookPayload>;
  run: (input: TInput, options?: { parentActorId?: string; signal?: AbortSignal }) => Promise<TOutput>;
  runSubagent: <TSubInput, TSubOutput>(
    agent: BaseAgentDefinition<TSubInput, TSubOutput, TMessage, THookPayload>,
    input: TSubInput,
  ) => Promise<TSubOutput>;
}

export function createAgentRuntime<
  TInput,
  TOutput,
  TMessage extends MemoryMessage = MemoryMessage,
  THookPayload = unknown,
>({
  agent,
  bus,
  hooks,
  memory,
  tools,
  commands,
  storage,
  artifacts,
}: CreateAgentRuntimeOptions<TInput, TOutput, TMessage, THookPayload>): AgentRuntime<TInput, TOutput, TMessage, THookPayload> {
  const resolvedTools = tools ?? new ToolRegistry();
  const resolvedHooks = hooks ?? new HookRegistry<THookPayload>();
  const resolvedStorage = storage === undefined
    ? artifacts?.storage ?? resolveHarnessStorage()
    : resolveHarnessStorage(storage);
  const resolvedArtifacts = artifacts ?? new ArtifactRegistry({ storage: resolvedStorage });
  const components: BaseAgentComponents<TMessage, THookPayload> = {
    bus: resolveAgentBus(bus, { hooks: resolvedHooks as HookRegistry }),
    hooks: resolvedHooks,
    memory: memory ?? new MemoryRegistry<TMessage>(),
    tools: resolvedTools,
    commands: commands ?? createDefaultCommandRegistry({ tools: resolvedTools }),
    storage: resolvedStorage,
    artifacts: resolvedArtifacts,
  };

  const run = async (
    input: TInput,
    options: { parentActorId?: string; signal?: AbortSignal } = {},
  ): Promise<TOutput> => runActorWorkflow<TInput, TOutput>({
    actorId: agent.id,
    parentActorId: options.parentActorId,
    input,
    bus: components.bus,
    signal: options.signal,
    hooks: components.hooks as HookRegistry,
    run: async ({ parentActorId, signal }) => {
      await appendAgentEvent(components.bus, {
        eventType: 'agent.instructions',
        actorId: agent.id,
        parentActorId,
        instructions: agent.instructions,
      });
      return agent.run(input, {
        ...components,
        agentId: agent.id,
        parentActorId,
        instructions: agent.instructions,
        signal,
        runSubagent: (subagent, subagentInput) => createAgentRuntime({
          agent: subagent,
          ...components,
        }).run(subagentInput, { parentActorId: agent.id, signal }),
      });
    },
  });

  return {
    id: agent.id,
    instructions: agent.instructions,
    components,
    run,
    runSubagent: (subagent, input) => createAgentRuntime({
      agent: subagent,
      ...components,
    }).run(input, { parentActorId: agent.id }),
  };
}
