import { assign, createActor, fromPromise, setup } from 'xstate';
import type { IAgentBus } from 'logact';
import { appendAgentEvent, resolveAgentBus } from './agentBus.js';

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
  run,
}: ActorWorkflowOptions<TInput, TOutput>): Promise<TOutput> {
  const eventBus = resolveAgentBus(bus);
  await appendAgentEvent(eventBus, {
    eventType: 'actor.workflow.started',
    actorId,
    parentActorId,
    data: { input },
  });

  const machine = setup({
    actors: {
      runTask: fromPromise(async () => run({ actorId, parentActorId, input, bus: eventBus, signal })),
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
    await appendAgentEvent(eventBus, {
      eventType: 'actor.workflow.failed',
      actorId,
      parentActorId,
      data: { error: finalSnapshot.context.error },
    });
    throw finalSnapshot.context.error;
  }

  await appendAgentEvent(eventBus, {
    eventType: 'actor.workflow.completed',
    actorId,
    parentActorId,
    data: { output: finalSnapshot.context.output },
  });
  return finalSnapshot.context.output as TOutput;
}
