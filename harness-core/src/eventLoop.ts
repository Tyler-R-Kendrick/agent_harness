import { assign, createActor, fromPromise, setup } from 'xstate';
import { withHarnessTelemetrySpan } from './telemetry.js';

export type AgentLoopActorMode = 'serial' | 'parallel';

export interface AgentLoopDispatchEvent<TPayload = unknown> {
  type: string;
  payload?: TPayload;
}

export interface AgentLoopEvent<TPayload = unknown> extends AgentLoopDispatchEvent<TPayload> {
  id: string;
  workflowId: string;
  runId: string;
  timestamp: number;
  state?: string;
  actorId?: string;
  parentActorId?: string;
}

export interface AgentLoopEventPublisherContext {
  workflowId: string;
  runId: string;
  signal?: AbortSignal;
}

export interface AgentLoopEventPublisher {
  id: string;
  publish: (
    event: AgentLoopEvent,
    context: AgentLoopEventPublisherContext,
  ) => Promise<void> | void;
}

export class AgentLoopEventPublisherRegistry {
  private readonly publishers = new Map<string, AgentLoopEventPublisher>();

  register(publisher: AgentLoopEventPublisher): void {
    if (this.publishers.has(publisher.id)) {
      throw new Error(`Event publisher already registered: ${publisher.id}`);
    }
    this.publishers.set(publisher.id, publisher);
  }

  get(id: string): AgentLoopEventPublisher | undefined {
    return this.publishers.get(id);
  }

  list(): AgentLoopEventPublisher[] {
    return [...this.publishers.values()];
  }

  async publish(event: AgentLoopEvent, context: AgentLoopEventPublisherContext): Promise<void> {
    for (const publisher of this.publishers.values()) {
      await publisher.publish(event, context);
    }
  }
}

export interface AgentLoopActorResult<TOutput = unknown> {
  event?: AgentLoopDispatchEvent;
  output?: TOutput;
}

export interface AgentLoopActorContext<TInput = unknown> {
  workflowId: string;
  runId: string;
  state: string;
  eventType: string;
  actorId: string;
  parentActorId?: string;
  input?: TInput;
  signal?: AbortSignal;
  publish: (type: string, payload?: unknown) => Promise<AgentLoopEvent>;
  runSubagent: <TOutput = unknown>(
    actorId: string,
    input?: unknown,
  ) => Promise<AgentLoopActorResult<TOutput>>;
}

export interface AgentLoopActor<TInput = unknown, TOutput = unknown> {
  id: string;
  event: string;
  run: (
    context: AgentLoopActorContext<TInput>,
  ) => Promise<AgentLoopActorResult<TOutput> | void> | AgentLoopActorResult<TOutput> | void;
}

type RegisteredActor = {
  actor: AgentLoopActor;
  order: number;
};

export class AgentLoopActorRegistry {
  private readonly actors = new Map<string, RegisteredActor>();
  private nextOrder = 0;

  register(actor: AgentLoopActor): void {
    if (this.actors.has(actor.id)) {
      throw new Error(`Agent loop actor already registered: ${actor.id}`);
    }
    this.actors.set(actor.id, { actor, order: this.nextOrder });
    this.nextOrder += 1;
  }

  get<TInput = unknown, TOutput = unknown>(id: string): AgentLoopActor<TInput, TOutput> | undefined {
    return this.actors.get(id)?.actor as AgentLoopActor<TInput, TOutput> | undefined;
  }

  list(): AgentLoopActor[] {
    return [...this.actors.values()]
      .sort((left, right) => left.order - right.order)
      .map(({ actor }) => actor);
  }

  forEvent(event: string): AgentLoopActor[] {
    return this.list().filter((actor) => actor.event === event);
  }
}

export interface SerializableAgentLoopEventInvocation {
  type: string;
  actorIds?: string[];
  mode?: AgentLoopActorMode;
  input?: unknown;
}

export interface SerializableAgentLoopStateDefinition {
  type?: 'final';
  events?: SerializableAgentLoopEventInvocation[];
  on?: Record<string, string>;
}

export interface SerializableAgentLoopDefinition {
  id: string;
  initial: string;
  states: Record<string, SerializableAgentLoopStateDefinition>;
}

export interface AgentEventLoopOptions {
  actors: AgentLoopActorRegistry;
  publishers?: AgentLoopEventPublisherRegistry;
  runId?: string;
  signal?: AbortSignal;
  maxTransitions?: number;
}

export interface AgentEventLoopResult {
  workflowId: string;
  runId: string;
  finalState: string;
  transitions: number;
  dispatchedEvents: AgentLoopDispatchEvent[];
}

interface AgentEventLoopRuntime {
  definition: SerializableAgentLoopDefinition;
  actors: AgentLoopActorRegistry;
  publishers: AgentLoopEventPublisherRegistry;
  workflowId: string;
  runId: string;
  signal?: AbortSignal;
  eventIndex: number;
  dispatchedEvents: AgentLoopDispatchEvent[];
}

type StateActorOutput = {
  dispatch?: AgentLoopDispatchEvent;
};

type StateActorContext = {
  output?: StateActorOutput;
  error?: unknown;
};

export async function runAgentEventLoop(
  definition: SerializableAgentLoopDefinition,
  options: AgentEventLoopOptions,
): Promise<AgentEventLoopResult> {
  const runtime: AgentEventLoopRuntime = {
    definition,
    actors: options.actors,
    publishers: options.publishers ?? new AgentLoopEventPublisherRegistry(),
    workflowId: definition.id,
    runId: options.runId ?? `${definition.id}:run`,
    signal: options.signal,
    eventIndex: 0,
    dispatchedEvents: [],
  };
  const maxTransitions = options.maxTransitions ?? 100;
  return withHarnessTelemetrySpan('harness.agent_event_loop.workflow', {
    attributes: {
      'agent.workflow.id': runtime.workflowId,
      'agent.workflow.run_id': runtime.runId,
      'agent.workflow.max_transitions': maxTransitions,
    },
  }, async (span) => {
    const result = await runAgentEventLoopRuntime(runtime, maxTransitions);
    span.setAttributes({
      'agent.workflow.final_state': result.finalState,
      'agent.workflow.transitions': result.transitions,
    });
    return result;
  });
}

async function runAgentEventLoopRuntime(
  runtime: AgentEventLoopRuntime,
  maxTransitions: number,
): Promise<AgentEventLoopResult> {
  let stateName = runtime.definition.initial;
  let transitions = 0;

  await publishRuntimeEvent(runtime, 'agent-loop.workflow.started');
  while (true) {
    const state = runtime.definition.states[stateName];
    if (!state) {
      await publishRuntimeEvent(runtime, 'agent-loop.workflow.failed', { state: stateName });
      throw new Error(`Unknown workflow state: ${stateName}`);
    }
    if (state.type === 'final') {
      await publishRuntimeEvent(runtime, 'agent-loop.workflow.completed', { state: stateName, transitions });
      return {
        workflowId: runtime.definition.id,
        runId: runtime.runId,
        finalState: stateName,
        transitions,
        dispatchedEvents: runtime.dispatchedEvents,
      };
    }
    if (transitions >= maxTransitions) {
      await publishRuntimeEvent(runtime, 'agent-loop.workflow.failed', { state: stateName, maxTransitions });
      throw new Error(`Agent event loop exceeded ${maxTransitions} transition(s).`);
    }

    await publishRuntimeEvent(runtime, 'agent-loop.state.entered', undefined, { state: stateName });
    let stateResult: StateActorOutput;
    try {
      stateResult = await runStateActor(runtime, stateName, state);
    } catch (error) {
      await publishRuntimeEvent(runtime, 'agent-loop.workflow.failed', { state: stateName, error });
      throw error;
    }
    const { dispatch } = stateResult;
    if (!dispatch) {
      await publishRuntimeEvent(runtime, 'agent-loop.workflow.failed', { state: stateName });
      throw new Error(`No event dispatched from workflow state: ${stateName}`);
    }

    runtime.dispatchedEvents.push(dispatch);
    await publishRuntimeEvent(runtime, 'agent-loop.event.dispatched', { event: dispatch }, { state: stateName });
    const nextState = state.on?.[dispatch.type];
    if (!nextState) {
      await publishRuntimeEvent(runtime, 'agent-loop.workflow.failed', { state: stateName, event: dispatch });
      throw new Error(`No transition for event "${dispatch.type}" from workflow state "${stateName}".`);
    }
    await publishRuntimeEvent(runtime, 'agent-loop.state.exited', { nextState }, { state: stateName });
    stateName = nextState;
    transitions += 1;
  }
}

async function runStateActor(
  runtime: AgentEventLoopRuntime,
  stateName: string,
  state: SerializableAgentLoopStateDefinition,
): Promise<StateActorOutput> {
  const machine = setup({
    actors: {
      runState: fromPromise(async () => runStateEvents(runtime, stateName, state)),
    },
    actions: {
      assignOutput: assign({
        output: ({ event }) => (event as unknown as { output: StateActorOutput }).output,
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
          src: 'runState',
          onDone: { target: 'completed', actions: 'assignOutput' },
          onError: { target: 'failed', actions: 'assignError' },
        },
      },
      completed: { type: 'final' },
      failed: { type: 'final' },
    },
  });

  const actor = createActor(machine);
  const snapshotEvents: Array<Promise<AgentLoopEvent>> = [];
  const finalSnapshot = await new Promise<{ value: unknown; context: StateActorContext }>((resolve) => {
    const subscription = actor.subscribe((snapshot) => {
      snapshotEvents.push(publishRuntimeEvent(runtime, 'agent-loop.xstate.snapshot', {
        value: snapshot.value,
        status: snapshot.status,
      }, { state: stateName }));
      if (snapshot.status === 'done') {
        subscription.unsubscribe();
        resolve({ value: snapshot.value, context: snapshot.context });
      }
    });
    actor.start();
  });
  await Promise.all(snapshotEvents);

  if (finalSnapshot.value === 'failed') {
    throw finalSnapshot.context.error;
  }
  return finalSnapshot.context.output as StateActorOutput;
}

async function runStateEvents(
  runtime: AgentEventLoopRuntime,
  stateName: string,
  state: SerializableAgentLoopStateDefinition,
): Promise<StateActorOutput> {
  let dispatch: AgentLoopDispatchEvent | undefined;
  for (const invocation of state.events ?? []) {
    const result = invocation.mode === 'parallel'
      ? await runParallelEventInvocation(runtime, stateName, invocation)
      : await runSerialEventInvocation(runtime, stateName, invocation);
    if (result.dispatch) {
      dispatch = result.dispatch;
      break;
    }
  }
  return dispatch ? { dispatch } : {};
}

async function runSerialEventInvocation(
  runtime: AgentEventLoopRuntime,
  stateName: string,
  invocation: SerializableAgentLoopEventInvocation,
): Promise<StateActorOutput> {
  await publishRuntimeEvent(runtime, invocation.type, invocation.input, { state: stateName });
  let dispatch: AgentLoopDispatchEvent | undefined;
  for (const actor of resolveInvocationActors(runtime.actors, invocation)) {
    const result = await runRegisteredActor(runtime, stateName, invocation, actor);
    if (result.event) {
      if (dispatch) {
        throw new Error(
          `Multiple actors dispatched events for event "${invocation.type}": "${dispatch.type}" and "${result.event.type}". Only one actor may dispatch per invocation.`,
        );
      }
      dispatch = result.event;
    }
  }
  return dispatch ? { dispatch } : {};
}

async function runParallelEventInvocation(
  runtime: AgentEventLoopRuntime,
  stateName: string,
  invocation: SerializableAgentLoopEventInvocation,
): Promise<StateActorOutput> {
  await publishRuntimeEvent(runtime, invocation.type, invocation.input, { state: stateName });
  const results = await Promise.all(resolveInvocationActors(runtime.actors, invocation)
    .map((actor) => runRegisteredActor(runtime, stateName, invocation, actor)));
  const dispatches = results.filter((result) => result.event);
  if (dispatches.length > 1) {
    const types = dispatches.map((d) => `"${d.event!.type}"`).join(', ');
    throw new Error(
      `Multiple actors dispatched conflicting events in parallel for event "${invocation.type}": ${types}`,
    );
  }
  const dispatch = dispatches[0]?.event;
  return dispatch ? { dispatch } : {};
}

function resolveInvocationActors(
  registry: AgentLoopActorRegistry,
  invocation: SerializableAgentLoopEventInvocation,
): AgentLoopActor[] {
  const actors = invocation.actorIds
    ? invocation.actorIds.map((id) => registry.get(id))
    : registry.forEvent(invocation.type);
  if (actors.length === 0 || actors.some((actor) => !actor)) {
    throw new Error(`No actors registered for event: ${invocation.type}`);
  }
  return actors as AgentLoopActor[];
}

async function runRegisteredActor(
  runtime: AgentEventLoopRuntime,
  stateName: string,
  invocation: SerializableAgentLoopEventInvocation,
  actor: AgentLoopActor,
  parentActorId?: string,
  input: unknown = invocation.input,
): Promise<AgentLoopActorResult> {
  return withHarnessTelemetrySpan('harness.agent_event_loop.actor', {
    attributes: {
      'agent.workflow.id': runtime.workflowId,
      'agent.workflow.run_id': runtime.runId,
      'agent.workflow.state': stateName,
      'agent.actor.id': actor.id,
      'agent.event.type': invocation.type,
      ...(parentActorId !== undefined ? { 'agent.actor.parent_id': parentActorId } : {}),
    },
  }, async (span) => {
    await publishRuntimeEvent(runtime, 'agent-loop.actor.started', { input }, {
      state: stateName,
      actorId: actor.id,
      parentActorId,
    });
    try {
      const result = await actor.run({
        workflowId: runtime.workflowId,
        runId: runtime.runId,
        state: stateName,
        eventType: invocation.type,
        actorId: actor.id,
        parentActorId,
        input,
        signal: runtime.signal,
        publish: (type, payload) => publishRuntimeEvent(runtime, type, payload, {
          state: stateName,
          actorId: actor.id,
          parentActorId,
        }),
        runSubagent: async <TOutput = unknown>(actorId: string, subagentInput?: unknown) => {
          const subagent = runtime.actors.get(actorId);
          if (!subagent) {
            throw new Error(`Unknown subagent actor: ${actorId}`);
          }
          return await runRegisteredActor(
            runtime,
            stateName,
            { type: subagent.event, input: subagentInput },
            subagent,
            actor.id,
            subagentInput,
          ) as AgentLoopActorResult<TOutput>;
        },
      });
      const output = result ?? {};
      span.setAttribute('agent.actor.dispatched_event', output.event?.type ?? '');
      await publishRuntimeEvent(runtime, 'agent-loop.actor.completed', { output: output.output }, {
        state: stateName,
        actorId: actor.id,
        parentActorId,
      });
      return output;
    } catch (error) {
      await publishRuntimeEvent(runtime, 'agent-loop.actor.failed', { error }, {
        state: stateName,
        actorId: actor.id,
        parentActorId,
      });
      throw error;
    }
  });
}

async function publishRuntimeEvent(
  runtime: AgentEventLoopRuntime,
  type: string,
  payload?: unknown,
  refs: {
    state?: string;
    actorId?: string;
    parentActorId?: string;
  } = {},
): Promise<AgentLoopEvent> {
  const event: AgentLoopEvent = {
    id: `${runtime.runId}:event-${runtime.eventIndex}`,
    type,
    workflowId: runtime.workflowId,
    runId: runtime.runId,
    timestamp: Date.now(),
    ...(payload !== undefined ? { payload } : {}),
    ...(refs.state !== undefined ? { state: refs.state } : {}),
    ...(refs.actorId !== undefined ? { actorId: refs.actorId } : {}),
    ...(refs.parentActorId !== undefined ? { parentActorId: refs.parentActorId } : {}),
  };
  runtime.eventIndex += 1;
  await runtime.publishers.publish(event, {
    workflowId: runtime.workflowId,
    runId: runtime.runId,
    ...(runtime.signal !== undefined ? { signal: runtime.signal } : {}),
  });
  return event;
}
