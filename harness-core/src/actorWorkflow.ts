import { assign, createActor, fromPromise, setup } from 'xstate';
import type { IAgentBus } from 'logact';
import { appendAgentEvent, resolveAgentBus } from './agentBus.js';
import {
  ACTOR_WORKFLOW_HOOK_EVENTS,
  type HarnessHookEventDescriptor,
  type HarnessHookRunOptions,
  HookRegistry,
} from './hooks.js';

export interface ActorWorkflowRunContext<TInput> {
  actorId: string;
  parentActorId?: string;
  input: TInput;
  bus: IAgentBus;
  signal?: AbortSignal;
}

export interface ActorWorkflowOptions<TInput, TOutput> {
  actorId: string;
  parentActorId?: string;
  input: TInput;
  bus?: IAgentBus;
  signal?: AbortSignal;
  hooks?: HookRegistry;
  run: (context: ActorWorkflowRunContext<TInput>) => Promise<TOutput> | TOutput;
}

type WorkflowContext<TOutput> = {
  output?: TOutput;
  error?: unknown;
};

export async function runActorWorkflow<TInput, TOutput>({
  actorId,
  parentActorId,
  input,
  bus,
  signal,
  hooks,
  run,
}: ActorWorkflowOptions<TInput, TOutput>): Promise<TOutput> {
  const eventBus = resolveAgentBus(bus, { hooks, hookOptions: hookOptions(signal) });
  await runActorHook(hooks, ACTOR_WORKFLOW_HOOK_EVENTS.started, {
    actorId,
    parentActorId,
    input,
  }, signal);
  await appendAgentEvent(eventBus, {
    eventType: 'actor.workflow.started',
    actorId,
    parentActorId,
    data: { input },
  });
  const inputPayload = await runActorHook(hooks, ACTOR_WORKFLOW_HOOK_EVENTS.input, {
    input,
    actorId,
    parentActorId,
  }, signal);
  const workflowInput = inputPayload.input;

  const machine = setup({
    actors: {
      runTask: fromPromise(async () => run({ actorId, parentActorId, input: workflowInput, bus: eventBus, signal })),
    },
    actions: {
      assignOutput: assign({
        output: ({ event }) => (event as unknown as { output: TOutput }).output,
      }),
      assignError: assign({
        error: ({ event }) => (event as unknown as { error: unknown }).error,
      }),
    },
  }).createMachine({
    initial: 'running',
    context: {},
    states: {
      running: {
        invoke: {
          src: 'runTask',
          onDone: { target: 'completed', actions: 'assignOutput' },
          onError: { target: 'failed', actions: 'assignError' },
        },
      },
      completed: { type: 'final' },
      failed: { type: 'final' },
    },
  });

  const finalSnapshot = await new Promise<{ value: unknown; context: WorkflowContext<TOutput> }>((resolve) => {
    const actor = createActor(machine);
    const subscription = actor.subscribe((snapshot) => {
      if (snapshot.status === 'done') {
        subscription.unsubscribe();
        resolve({ value: snapshot.value, context: snapshot.context });
      }
    });
    actor.start();
  });

  if (finalSnapshot.value === 'failed') {
    await runActorHook(hooks, ACTOR_WORKFLOW_HOOK_EVENTS.failed, {
      actorId,
      parentActorId,
      error: finalSnapshot.context.error,
    }, signal);
    await appendAgentEvent(eventBus, {
      eventType: 'actor.workflow.failed',
      actorId,
      parentActorId,
      data: { error: finalSnapshot.context.error },
    });
    throw finalSnapshot.context.error;
  }

  const outputPayload = await runActorHook(hooks, ACTOR_WORKFLOW_HOOK_EVENTS.output, {
    actorId,
    parentActorId,
    output: finalSnapshot.context.output as TOutput,
  }, signal);
  await appendAgentEvent(eventBus, {
    eventType: 'actor.workflow.completed',
    actorId,
    parentActorId,
    data: { output: outputPayload.output },
  });
  await runActorHook(hooks, ACTOR_WORKFLOW_HOOK_EVENTS.completed, {
    actorId,
    parentActorId,
    output: outputPayload.output,
  }, signal);
  return outputPayload.output;
}

async function runActorHook<TPayload>(
  hooks: HookRegistry | undefined,
  event: HarnessHookEventDescriptor,
  payload: TPayload,
  signal?: AbortSignal,
): Promise<TPayload> {
  if (!hooks) {
    return payload;
  }
  return (await hooks.runEvent(event, payload, hookOptions(signal))).payload;
}

function hookOptions(signal?: AbortSignal): HarnessHookRunOptions {
  return signal === undefined ? {} : { signal };
}
