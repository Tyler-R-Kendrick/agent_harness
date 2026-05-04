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
  AgentLoopActorRegistry,
  AgentLoopEventPublisherRegistry,
  LLM_HOOK_EVENTS,
  createActorMessageEvent,
  normalizeSession,
  runAgentEventLoop,
  withAgentBusHooks,
  type ActorMessageEvent,
  type ActorRef,
  type AgentLoopEvent,
  type AgentSessionRef,
  type HarnessHookEventDescriptor,
  type HookRegistry,
  type SerializableAgentLoopDefinition,
} from 'harness-core';
import { wrapCompletionCheckerWithCallbacks } from './chat-agents/completionChecker.js';
import { wrapVoterWithCallbacks } from './chat-agents/voter.js';
import type { CoreInferenceClient } from 'harness-core';
import { LOGACT_AGENT_LOOP_HOOK_EVENTS } from './hooks.js';
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
  hooks?: HookRegistry;
}

export class WorkflowAgentBus implements IAgentBus {
  private readonly bus: IAgentBus;
  private readonly sessionRef: AgentSessionRef;
  private readonly actorMessages: Array<ActorMessageEvent<WorkflowMessage, 'actor.message'>> = [];
  private readonly workflowEvents: WorkflowEvent[] = [];

  constructor(options: WorkflowAgentBusOptions = {}) {
    const bus = options.bus ?? new InMemoryAgentBus();
    this.bus = options.hooks ? withAgentBusHooks(bus, options.hooks) : bus;
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

export interface LogActWorkflowDefinition extends SerializableAgentLoopDefinition {
  context: {
    session: AgentSessionRef;
    voterIds: string[];
    maxTurns: number;
  };
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
        events: [{ type: 'logact.trigger', actorIds: ['waitForTriggerAgent'] }],
        on: { 'logact.trigger.ready': 'inferring' },
      },
      inferring: {
        events: [{ type: 'logact.driver', actorIds: ['driverAgent'] }],
        on: { 'logact.driver.terminal': 'done', 'logact.intent.created': 'voting' },
      },
      voting: {
        events: [{ type: 'logact.voters', actorIds: ['voterAgents'], mode: 'parallel' }],
        on: { 'logact.votes.created': 'deciding' },
      },
      deciding: {
        events: [{ type: 'logact.decider', actorIds: ['deciderAgent'] }],
        on: {
          'logact.decision.commit': 'executing',
          'logact.decision.continue': 'awaitingTrigger',
          'logact.decision.done': 'done',
        },
      },
      executing: {
        events: [{ type: 'logact.executor', actorIds: ['executorAgent'] }],
        on: { 'logact.result.created': 'checkingCompletion' },
      },
      checkingCompletion: {
        events: [{ type: 'logact.completion', actorIds: ['completionCheckerAgent'] }],
        on: { 'logact.completion.done': 'done', 'logact.completion.continue': 'awaitingTrigger' },
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
    hooks,
  }: LogActAgentLoopOptions,
  callbacks: CoreAgentLoopCallbacks,
): Promise<void> {
  const workflowBus = bus
    ? hooks ? withAgentBusHooks(bus, hooks) : bus
    : new WorkflowAgentBus({ session, hooks });
  await runLogActHook(hooks, LOGACT_AGENT_LOOP_HOOK_EVENTS.loopStart, {
    input: input ?? messages.at(-1)?.content ?? '',
    messages,
  });
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
    hooks,
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
  } finally {
    await runLogActHook(hooks, LOGACT_AGENT_LOOP_HOOK_EVENTS.loopEnd, {
      input: input ?? messages.at(-1)?.content ?? '',
    });
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
  hooks?: HookRegistry;
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
  hooks?: HookRegistry;
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
  const actors = createLogActActorRegistry(runtime);
  const publishers = createLogActWorkflowPublishers(bus);
  await runLogActHook(runtime.hooks, LOGACT_AGENT_LOOP_HOOK_EVENTS.workflowStart, { definition });
  await runAgentEventLoop(definition, {
    actors,
    publishers,
    runId: definition.context.session.id,
    maxTransitions: definition.context.maxTurns * 6 + 2,
  });
}

function createLogActActorRegistry(runtime: WorkflowRuntime): AgentLoopActorRegistry {
  const actors = new AgentLoopActorRegistry();
  actors.register({
    id: 'waitForTriggerAgent',
    event: 'logact.trigger',
    run: async () => {
      const entries = await waitForTrigger(runtime);
      return { event: { type: 'logact.trigger.ready' }, output: entries };
    },
  });
  actors.register({
    id: 'driverAgent',
    event: 'logact.driver',
    run: async () => {
      const result = await runDriverAgent(runtime);
      return {
        event: { type: result.terminal ? 'logact.driver.terminal' : 'logact.intent.created' },
        output: result,
      };
    },
  });
  actors.register({
    id: 'voterAgents',
    event: 'logact.voters',
    run: async () => ({
      event: { type: 'logact.votes.created' },
      output: await runVoterAgents(runtime),
    }),
  });
  actors.register({
    id: 'deciderAgent',
    event: 'logact.decider',
    run: async () => {
      const result = await runDeciderAgent(runtime);
      const type = result.decision === 'commit'
        ? 'logact.decision.commit'
        : result.shouldContinue
          ? 'logact.decision.continue'
          : 'logact.decision.done';
      return { event: { type }, output: result };
    },
  });
  actors.register({
    id: 'executorAgent',
    event: 'logact.executor',
    run: async () => ({
      event: { type: 'logact.result.created' },
      output: await runExecutorAgent(runtime),
    }),
  });
  actors.register({
    id: 'completionCheckerAgent',
    event: 'logact.completion',
    run: async () => {
      const result = await runCompletionCheckerAgent(runtime);
      return {
        event: { type: result.done ? 'logact.completion.done' : 'logact.completion.continue' },
        output: result,
      };
    },
  });
  return actors;
}

function createLogActWorkflowPublishers(bus: IAgentBus): AgentLoopEventPublisherRegistry {
  const publishers = new AgentLoopEventPublisherRegistry();
  if (bus instanceof WorkflowAgentBus) {
    publishers.register({
      id: 'workflow-agent-bus',
      publish: (event) => publishWorkflowEventToBus(bus, event),
    });
  }
  return publishers;
}

function publishWorkflowEventToBus(bus: WorkflowAgentBus, event: AgentLoopEvent): void {
  if (event.type === 'agent-loop.workflow.started') {
    bus.sendWorkflowEvent({ type: 'START', workflowId: event.workflowId, runId: event.runId });
  }
  if (event.type === 'agent-loop.state.entered' && event.state) {
    bus.recordWorkflowSnapshot(event.state, 'active');
  }
  if (event.type === 'agent-loop.workflow.completed') {
    bus.recordWorkflowSnapshot((event.payload as { state: unknown }).state, 'done');
  }
}

async function waitForTrigger(runtime: WorkflowRuntime): Promise<Entry[]> {
  await runLogActHook(runtime.hooks, LOGACT_AGENT_LOOP_HOOK_EVENTS.triggerInput, {
    cursor: runtime.cursor,
  });
  const triggerEntries = await runtime.bus.poll(runtime.cursor, [
    PayloadType.Mail,
    PayloadType.Result,
    PayloadType.Abort,
  ]);
  runtime.cursor = Math.max(...triggerEntries.map((entry) => entry.position)) + 1;
  await runLogActHook(runtime.hooks, LOGACT_AGENT_LOOP_HOOK_EVENTS.triggerOutput, {
    entries: triggerEntries,
    cursor: runtime.cursor,
  });
  return triggerEntries;
}

async function runDriverAgent(runtime: WorkflowRuntime): Promise<{ terminal: boolean; intent?: IntentPayload }> {
  const inputPayload = await runLogActHook(runtime.hooks, LOGACT_AGENT_LOOP_HOOK_EVENTS.driverInput, {
    messages: buildMessages(await readAllEntries(runtime.bus)),
  });
  const llmInputPayload = await runLogActHook(runtime.hooks, LLM_HOOK_EVENTS.input, inputPayload);
  const messages = llmInputPayload.messages;
  await runtime.bus.append({
    type: PayloadType.InfIn,
    messages,
    meta: { actorId: 'driver', actorRole: 'agent' },
  });

  const rawText = await runtime.inferenceClient.infer(messages);
  const outputPayload = await runLogActHook(runtime.hooks, LLM_HOOK_EVENTS.output, {
    text: rawText,
    actorId: 'driver',
  });
  await runLogActHook(runtime.hooks, LOGACT_AGENT_LOOP_HOOK_EVENTS.driverOutput, outputPayload);
  const outputText = outputPayload.text;
  if (!outputText.trim()) {
    return { terminal: true };
  }

  await runtime.bus.append({
    type: PayloadType.InfOut,
    text: outputText,
    meta: { actorId: 'driver', actorRole: 'agent' },
  });
  runtime.intentIndex += 1;
  const intent: IntentPayload = {
    type: PayloadType.Intent,
    intentId: `intent-${runtime.intentIndex}`,
    action: outputText.trim(),
    meta: { actorId: 'driver', actorRole: 'agent' },
  };
  await runtime.bus.append(intent);
  runtime.currentIntent = intent;
  runtime.currentVotes = [];
  return { terminal: false, intent };
}

async function runVoterAgents(runtime: WorkflowRuntime): Promise<VotePayload[]> {
  const intent = requireCurrentIntent(runtime);
  await runLogActHook(runtime.hooks, LOGACT_AGENT_LOOP_HOOK_EVENTS.voterInput, {
    intent,
    voterIds: runtime.voters.map((voter) => voter.id),
  });
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
  await runLogActHook(runtime.hooks, LOGACT_AGENT_LOOP_HOOK_EVENTS.voterOutput, { votes });
  return votes;
}

async function runDeciderAgent(
  runtime: WorkflowRuntime,
): Promise<{ decision: 'abort' | 'commit'; shouldContinue: boolean }> {
  const intent = requireCurrentIntent(runtime);
  await runLogActHook(runtime.hooks, LOGACT_AGENT_LOOP_HOOK_EVENTS.deciderInput, {
    intent,
    votes: runtime.currentVotes,
  });
  const decision = evaluateQuorum(runtime.currentVotes, runtime.voters.length, runtime.quorumPolicy);
  if (decision === 'abort') {
    await runtime.bus.append({
      type: PayloadType.Abort,
      intentId: intent.intentId,
      reason: runtime.currentVotes.find((vote) => !vote.approve)?.reason,
      meta: { actorId: 'decider', actorRole: 'agent' },
    });
    runtime.turnCount += 1;
    const result = { decision: 'abort' as const, shouldContinue: shouldContinue(runtime) };
    await runLogActHook(runtime.hooks, LOGACT_AGENT_LOOP_HOOK_EVENTS.deciderOutput, result);
    return result;
  }

  await runtime.bus.append({
    type: PayloadType.Commit,
    intentId: intent.intentId,
    meta: { actorId: 'decider', actorRole: 'agent' },
  });
  const result = { decision: 'commit' as const, shouldContinue: true };
  await runLogActHook(runtime.hooks, LOGACT_AGENT_LOOP_HOOK_EVENTS.deciderOutput, result);
  return result;
}

async function runExecutorAgent(runtime: WorkflowRuntime): Promise<ResultPayload> {
  const intent = requireCurrentIntent(runtime);
  const executorInput = await runLogActHook(runtime.hooks, LOGACT_AGENT_LOOP_HOOK_EVENTS.executorInput, {
    action: intent.action,
    intent,
  });
  let output = '';
  let error: string | undefined;
  try {
    output = runtime.executor
      ? await runtime.executor.execute(executorInput.action)
      : executorInput.action;
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
  await runLogActHook(runtime.hooks, LOGACT_AGENT_LOOP_HOOK_EVENTS.executorOutput, { result });
  return result;
}

async function runCompletionCheckerAgent(
  runtime: WorkflowRuntime,
): Promise<{ done: boolean; completion?: CompletionPayload }> {
  const result = requireLastResult(runtime);
  await runLogActHook(runtime.hooks, LOGACT_AGENT_LOOP_HOOK_EVENTS.completionInput, { result });
  if (!runtime.completionChecker) {
    const completionResult = { done: !shouldContinue(runtime) };
    await runLogActHook(runtime.hooks, LOGACT_AGENT_LOOP_HOOK_EVENTS.completionOutput, completionResult);
    return completionResult;
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

  const completionResult = {
    done: normalizedCompletion.done || !shouldContinue(runtime),
    completion: normalizedCompletion,
  };
  await runLogActHook(runtime.hooks, LOGACT_AGENT_LOOP_HOOK_EVENTS.completionOutput, completionResult);
  return completionResult;
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

async function runLogActHook<TPayload>(
  hooks: HookRegistry | undefined,
  event: HarnessHookEventDescriptor,
  payload: TPayload,
): Promise<TPayload> {
  if (!hooks) {
    return payload;
  }
  return (await hooks.runEvent(event, payload)).payload;
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
