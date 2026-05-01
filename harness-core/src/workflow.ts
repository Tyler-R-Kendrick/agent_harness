import { createActor, fromPromise, setup } from 'xstate';
import { InMemoryAgentBus, QuorumPolicy, evaluateQuorum } from 'logact';
import type {
  CompletionPayload,
  Entry,
  IAgentBus,
  ICompletionChecker,
  IExecutor,
  IVoter,
  IntentPayload,
  MailPayload,
  Payload,
  ResultPayload,
  VotePayload,
} from 'logact';
import { PayloadType } from 'logact';
import {
  createActorMessageEvent,
  normalizeSession,
  type ActorMessageEvent,
  type ActorRef,
  type AgentSessionRef,
} from './agent.js';
import { wrapCompletionCheckerWithCallbacks } from './chat-agents/completionChecker.js';
import { wrapVoterWithCallbacks } from './chat-agents/voter.js';
import type { CoreInferenceClient } from './constrainedDecoding.js';
import type { CoreAgentLoopCallbacks, LogActAgentLoopOptions } from './logactLoopTypes.js';

export { wrapCompletionCheckerWithCallbacks } from './chat-agents/completionChecker.js';
export { wrapVoterWithCallbacks } from './chat-agents/voter.js';
export type {
  CoreAgentLoopCallbacks,
  CoreIterationStep,
  CoreStepStatus,
  CoreVoterStep,
  LogActAgentLoopOptions,
} from './logactLoopTypes.js';

export type WorkflowEvent =
  | { type: 'xstate.event'; sessionId: string; event: { type: string; [key: string]: unknown }; timestamp: number }
  | { type: 'xstate.snapshot'; sessionId: string; value: unknown; status: string; timestamp: number };

export interface WorkflowAgentBusOptions {
  session?: AgentSessionRef;
  bus?: IAgentBus;
}

export class WorkflowAgentBus implements IAgentBus {
  private readonly bus: IAgentBus;
  private readonly sessionRef: AgentSessionRef;
  private readonly actorMessages: Array<ActorMessageEvent<WorkflowMessage, 'actor.message'>> = [];
  private readonly workflowEvents: WorkflowEvent[] = [];

  constructor(options: WorkflowAgentBusOptions = {}) {
    this.bus = options.bus ?? new InMemoryAgentBus();
    this.sessionRef = normalizeSession(options.session);
  }

  get session(): AgentSessionRef {
    return this.sessionRef;
  }

  async append(payload: Payload): Promise<number> {
    const position = await this.bus.append(payload);
    const [entry] = await this.bus.read(position, position + 1);
    this.recordActorMessage(entry);
    return position;
  }

  read(start: number, end: number): Promise<Entry[]> {
    return this.bus.read(start, end);
  }

  tail(): Promise<number> {
    return this.bus.tail();
  }

  poll(start: number, filter: PayloadType[]): Promise<Entry[]> {
    return this.bus.poll(start, filter);
  }

  sendWorkflowEvent(event: { type: string; [key: string]: unknown }): void {
    this.workflowEvents.push({
      type: 'xstate.event',
      sessionId: this.sessionRef.id,
      event,
      timestamp: Date.now(),
    });
  }

  recordWorkflowSnapshot(value: unknown, status: string): void {
    this.workflowEvents.push({
      type: 'xstate.snapshot',
      sessionId: this.sessionRef.id,
      value,
      status,
      timestamp: Date.now(),
    });
  }

  readActorMessageEvents(): Array<ActorMessageEvent<WorkflowMessage, 'actor.message'>> {
    return [...this.actorMessages];
  }

  readWorkflowEvents(): WorkflowEvent[] {
    return [...this.workflowEvents];
  }

  private recordActorMessage(entry: Entry): void {
    const message = workflowMessageFromPayload(entry.payload, entry.realtimeTs);
    if (!message) {
      return;
    }

    const actor = actorFromPayload(entry.payload, this.sessionRef);
    this.actorMessages.push(createActorMessageEvent(
      'actor.message',
      message,
      this.sessionRef,
      () => actor,
      this.actorMessages.length,
      { kind: 'agent-bus', position: entry.position, payloadType: entry.payload.type },
    ));
  }
}

export interface WorkflowMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface LogActWorkflowDefinition {
  id: string;
  initial: string;
  context: {
    session: AgentSessionRef;
    voterIds: string[];
    maxTurns: number;
  };
  states: Record<string, unknown>;
}

export interface LogActWorkflowDefinitionOptions {
  id?: string;
  session?: AgentSessionRef;
  voterIds?: string[];
  maxTurns?: number;
}

export function createLogActWorkflowDefinition(
  options: LogActWorkflowDefinitionOptions = {},
): LogActWorkflowDefinition {
  const session = normalizeSession(options.session);
  return {
    id: options.id ?? `${session.id}:logact-workflow`,
    initial: 'awaitingTrigger',
    context: {
      session,
      voterIds: [...(options.voterIds ?? [])],
      maxTurns: options.maxTurns ?? 1,
    },
    states: {
      awaitingTrigger: {
        invoke: {
          src: 'waitForTriggerAgent',
          onDone: { target: 'inferring', actions: ['captureTrigger'] },
          onError: { target: 'done' },
        },
      },
      inferring: {
        invoke: {
          src: 'driverAgent',
          onDone: [
            { guard: 'isTerminalInference', target: 'done' },
            { target: 'voting', actions: ['captureIntent'] },
          ],
          onError: { target: 'done' },
        },
      },
      voting: {
        invoke: {
          src: 'voterAgents',
          onDone: { target: 'deciding', actions: ['captureVotes'] },
          onError: { target: 'done' },
        },
      },
      deciding: {
        invoke: {
          src: 'deciderAgent',
          onDone: [
            { guard: 'isCommitDecision', target: 'executing', actions: ['captureDecision'] },
            { guard: 'shouldContinueAfterDecision', target: 'awaitingTrigger', actions: ['captureDecision'] },
            { target: 'done', actions: ['captureDecision'] },
          ],
          onError: { target: 'done' },
        },
      },
      executing: {
        invoke: {
          src: 'executorAgent',
          onDone: { target: 'checkingCompletion', actions: ['captureResult'] },
          onError: { target: 'done' },
        },
      },
      checkingCompletion: {
        invoke: {
          src: 'completionCheckerAgent',
          onDone: [
            { guard: 'isWorkflowDone', target: 'done', actions: ['captureCompletion'] },
            { target: 'awaitingTrigger', actions: ['captureCompletion'] },
          ],
          onError: { target: 'done' },
        },
      },
      done: { type: 'final' },
    },
  };
}

export async function runLogActAgentLoop(
  {
    inferenceClient,
    messages,
    voters = [],
    input,
    bus,
    maxTurns = 1,
    maxIterations,
    quorumPolicy = voters.length > 0 ? QuorumPolicy.BooleanAnd : QuorumPolicy.OnByDefault,
    completionChecker,
    executor,
    session,
    constrainedDecoding,
  }: LogActAgentLoopOptions,
  callbacks: CoreAgentLoopCallbacks,
): Promise<void> {
  const workflowBus = bus ?? new WorkflowAgentBus({ session });
  const driverInferenceClient: CoreInferenceClient = constrainedDecoding
    ? {
        infer: (inferenceMessages, inferenceOptions) =>
          inferenceClient.infer(inferenceMessages, { ...inferenceOptions, constrainedDecoding }),
      }
    : inferenceClient;
  const runtime = createRuntime({
    bus: workflowBus,
    inferenceClient: driverInferenceClient,
    voters: voters.map((voter) => wrapVoterWithCallbacks(voter, callbacks)),
    quorumPolicy,
    completionChecker: completionChecker
      ? wrapCompletionCheckerWithCallbacks(completionChecker, callbacks)
      : undefined,
    executor,
    maxTurns: maxIterations ?? maxTurns,
  });
  const workflowSession = workflowBus instanceof WorkflowAgentBus
    ? workflowBus.session
    : normalizeSession(session);
  const definition = createLogActWorkflowDefinition({
    session: workflowSession,
    voterIds: voters.map((voter) => voter.id),
    maxTurns: maxIterations ?? maxTurns,
  });

  await workflowBus.append({
    type: PayloadType.Mail,
    from: 'user',
    content: input ?? messages.at(-1)?.content ?? '',
    meta: { actorId: 'user', actorRole: 'user' },
  });

  try {
    await runWorkflowMachine(definition, runtime, workflowBus);
  } catch {
    // Provider adapters are responsible for forwarding user-visible errors.
  }
}

interface WorkflowRuntime {
  bus: IAgentBus;
  inferenceClient: CoreInferenceClient;
  voters: IVoter[];
  quorumPolicy: QuorumPolicy;
  completionChecker?: ICompletionChecker;
  executor?: IExecutor;
  maxTurns: number;
  cursor: number;
  turnCount: number;
  intentIndex: number;
  currentIntent?: IntentPayload;
  currentVotes: VotePayload[];
  lastResult?: ResultPayload;
}

function createRuntime(options: {
  bus: IAgentBus;
  inferenceClient: CoreInferenceClient;
  voters: IVoter[];
  quorumPolicy: QuorumPolicy;
  completionChecker?: ICompletionChecker;
  executor?: IExecutor;
  maxTurns: number;
}): WorkflowRuntime {
  return {
    ...options,
    cursor: 0,
    turnCount: 0,
    intentIndex: 0,
    currentVotes: [],
  };
}

async function runWorkflowMachine(
  definition: LogActWorkflowDefinition,
  runtime: WorkflowRuntime,
  bus: IAgentBus,
): Promise<void> {
  const machine = createLogActWorkflowMachine(definition, runtime);
  const actor = createActor(machine);
  const done = new Promise<void>((resolve) => {
    actor.subscribe((snapshot) => {
      if (bus instanceof WorkflowAgentBus) {
        bus.recordWorkflowSnapshot(snapshot.value, snapshot.status);
      }
      if (snapshot.status === 'done' || snapshot.status === 'error') {
        resolve();
      }
    });
  });

  if (bus instanceof WorkflowAgentBus) {
    bus.sendWorkflowEvent({ type: 'START', workflowId: definition.id });
  }
  actor.start();
  await done;
}

function createLogActWorkflowMachine(
  definition: LogActWorkflowDefinition,
  runtime: WorkflowRuntime,
) {
  return setup({
    actions: {
      captureTrigger: () => undefined,
      captureIntent: () => undefined,
      captureVotes: () => undefined,
      captureDecision: () => undefined,
      captureResult: () => undefined,
      captureCompletion: () => undefined,
    },
    guards: {
      isTerminalInference: ({ event }) => eventHasOutput(event, 'terminal', true),
      isCommitDecision: ({ event }) => eventHasOutput(event, 'decision', 'commit'),
      shouldContinueAfterDecision: ({ event }) => eventHasOutput(event, 'shouldContinue', true),
      isWorkflowDone: ({ event }) => eventHasOutput(event, 'done', true),
    },
    actors: {
      waitForTriggerAgent: fromPromise(async () => waitForTrigger(runtime)),
      driverAgent: fromPromise(async () => runDriverAgent(runtime)),
      voterAgents: fromPromise(async () => runVoterAgents(runtime)),
      deciderAgent: fromPromise(async () => runDeciderAgent(runtime)),
      executorAgent: fromPromise(async () => runExecutorAgent(runtime)),
      completionCheckerAgent: fromPromise(async () => runCompletionCheckerAgent(runtime)),
    },
  }).createMachine(definition as never);
}

async function waitForTrigger(runtime: WorkflowRuntime): Promise<Entry[]> {
  const triggerEntries = await runtime.bus.poll(runtime.cursor, [
    PayloadType.Mail,
    PayloadType.Result,
    PayloadType.Abort,
  ]);
  runtime.cursor = Math.max(...triggerEntries.map((entry) => entry.position)) + 1;
  return triggerEntries;
}

async function runDriverAgent(runtime: WorkflowRuntime): Promise<{ terminal: boolean; intent?: IntentPayload }> {
  const messages = buildMessages(await readAllEntries(runtime.bus));
  await runtime.bus.append({
    type: PayloadType.InfIn,
    messages,
    meta: { actorId: 'driver', actorRole: 'agent' },
  });

  const rawText = await runtime.inferenceClient.infer(messages);
  if (!rawText.trim()) {
    return { terminal: true };
  }

  await runtime.bus.append({
    type: PayloadType.InfOut,
    text: rawText,
    meta: { actorId: 'driver', actorRole: 'agent' },
  });
  runtime.intentIndex += 1;
  const intent: IntentPayload = {
    type: PayloadType.Intent,
    intentId: `intent-${runtime.intentIndex}`,
    action: rawText.trim(),
    meta: { actorId: 'driver', actorRole: 'agent' },
  };
  await runtime.bus.append(intent);
  runtime.currentIntent = intent;
  runtime.currentVotes = [];
  return { terminal: false, intent };
}

async function runVoterAgents(runtime: WorkflowRuntime): Promise<VotePayload[]> {
  const intent = requireCurrentIntent(runtime);
  const votes = await Promise.all(runtime.voters.map(async (voter) => {
    const vote = await voter.vote(intent, runtime.bus);
    const normalizedVote: VotePayload = {
      ...vote,
      type: PayloadType.Vote,
      intentId: intent.intentId,
      voterId: voter.id,
    };
    return normalizedVote;
  }));
  for (const vote of votes) {
    await runtime.bus.append(vote);
  }
  runtime.currentVotes = votes;
  return votes;
}

async function runDeciderAgent(
  runtime: WorkflowRuntime,
): Promise<{ decision: 'abort' | 'commit'; shouldContinue: boolean }> {
  const intent = requireCurrentIntent(runtime);
  const decision = evaluateQuorum(runtime.currentVotes, runtime.voters.length, runtime.quorumPolicy);
  if (decision === 'abort') {
    await runtime.bus.append({
      type: PayloadType.Abort,
      intentId: intent.intentId,
      reason: runtime.currentVotes.find((vote) => !vote.approve)?.reason,
      meta: { actorId: 'decider', actorRole: 'agent' },
    });
    runtime.turnCount += 1;
    return { decision: 'abort', shouldContinue: shouldContinue(runtime) };
  }

  await runtime.bus.append({
    type: PayloadType.Commit,
    intentId: intent.intentId,
    meta: { actorId: 'decider', actorRole: 'agent' },
  });
  return { decision: 'commit', shouldContinue: true };
}

async function runExecutorAgent(runtime: WorkflowRuntime): Promise<ResultPayload> {
  const intent = requireCurrentIntent(runtime);
  let output = '';
  let error: string | undefined;
  try {
    output = runtime.executor
      ? await runtime.executor.execute(intent.action)
      : intent.action;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

  const result: ResultPayload = {
    type: PayloadType.Result,
    intentId: intent.intentId,
    output,
    ...(error !== undefined ? { error } : {}),
    meta: { actorId: 'executor', actorRole: 'agent' },
  };
  await runtime.bus.append(result);
  runtime.lastResult = result;
  runtime.turnCount += 1;
  return result;
}

async function runCompletionCheckerAgent(
  runtime: WorkflowRuntime,
): Promise<{ done: boolean; completion?: CompletionPayload }> {
  const result = requireLastResult(runtime);
  if (!runtime.completionChecker) {
    return { done: !shouldContinue(runtime) };
  }

  const history = await readAllEntries(runtime.bus);
  const completion = await runtime.completionChecker.check({
    task: getTaskFromHistory(history),
    lastResult: result,
    history,
  });
  const normalizedCompletion: CompletionPayload = {
    ...completion,
    type: PayloadType.Completion,
    intentId: result.intentId,
    meta: { actorId: 'completion-checker', actorRole: 'agent' },
  };
  await runtime.bus.append(normalizedCompletion);

  if (!normalizedCompletion.done && normalizedCompletion.feedback?.trim() && shouldContinue(runtime)) {
    await appendMail(runtime.bus, normalizedCompletion.feedback, 'completion-checker', 'agent');
  }

  return {
    done: normalizedCompletion.done || !shouldContinue(runtime),
    completion: normalizedCompletion,
  };
}

async function appendMail(
  bus: IAgentBus,
  content: string,
  from: string,
  actorRole: ActorRef['role'],
): Promise<void> {
  const mail: MailPayload = {
    type: PayloadType.Mail,
    from,
    content,
    meta: { actorId: from, actorRole },
  };
  await bus.append(mail);
}

function shouldContinue(runtime: WorkflowRuntime): boolean {
  return runtime.turnCount < runtime.maxTurns;
}

async function readAllEntries(bus: IAgentBus): Promise<Entry[]> {
  return bus.read(0, await bus.tail());
}

function requireCurrentIntent(runtime: WorkflowRuntime): IntentPayload {
  return runtime.currentIntent as IntentPayload;
}

function requireLastResult(runtime: WorkflowRuntime): ResultPayload {
  return runtime.lastResult as ResultPayload;
}

function buildMessages(entries: Entry[]): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

  for (const entry of entries) {
    const { payload } = entry;
    if (payload.type === PayloadType.Mail) {
      messages.push({ role: 'user', content: payload.content });
    } else if (payload.type === PayloadType.InfOut) {
      messages.push({ role: 'assistant', content: payload.text });
    } else if (payload.type === PayloadType.Result) {
      messages.push({
        role: 'user',
        content: payload.error
          ? `Error: ${payload.error}`
          : `Result: ${payload.output}`,
      });
    } else if (payload.type === PayloadType.Abort) {
      messages.push({
        role: 'user',
        content: `Action was aborted: ${payload.reason ?? 'no reason given'}`,
      });
    }
  }
  return messages;
}

function getTaskFromHistory(entries: Entry[]): string | undefined {
  const firstMail = entries.find((entry) => entry.payload.type === PayloadType.Mail) as Entry & { payload: MailPayload };
  return firstMail.payload.content;
}

function workflowMessageFromPayload(payload: Payload, timestamp: number): WorkflowMessage | undefined {
  if (payload.type === PayloadType.Mail) {
    return {
      id: `message-${timestamp}-${payload.from}`,
      role: 'user',
      content: payload.content,
      timestamp,
    };
  }
  if (payload.type === PayloadType.InfOut) {
    return {
      id: `message-${timestamp}-driver`,
      role: 'assistant',
      content: payload.text,
      timestamp,
    };
  }
  return undefined;
}

function actorFromPayload(payload: Payload, session: AgentSessionRef): ActorRef {
  if (payload.type === PayloadType.Mail) {
    return {
      id: payload.meta?.actorId ?? payload.from,
      role: payload.meta?.actorRole ?? 'user',
      sessionId: session.id,
    };
  }
  return {
    id: payload.meta?.actorId ?? 'driver',
    role: payload.meta?.actorRole ?? 'agent',
    sessionId: session.id,
  };
}

function eventHasOutput(event: unknown, key: string, value: unknown): boolean {
  return typeof event === 'object'
    && event !== null
    && 'output' in event
    && typeof (event as { output?: unknown }).output === 'object'
    && (event as { output?: Record<string, unknown> }).output?.[key] === value;
}
