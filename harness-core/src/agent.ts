import { PendingMessageQueue, type QueueMode } from './queue.js';
import { SpanKind, type Span } from '@opentelemetry/api';
import {
  AGENT_LOOP_HOOK_EVENTS,
  LLM_HOOK_EVENTS,
  type HarnessHookEventDescriptor,
  type HarnessHookRunOptions,
  HookRegistry,
} from './hooks.js';
import { setHarnessTelemetryAttributes, withHarnessTelemetrySpan } from './telemetry.js';

export interface HarnessMessage {
  role: string;
  content: string;
  timestamp: number;
  [key: string]: unknown;
}

export type AgentSessionMode = 'local' | 'shared' | 'remote' | string;

export interface AgentSessionRef {
  id: string;
  mode?: AgentSessionMode;
  metadata?: Record<string, unknown>;
}

export type ActorRole = 'user' | 'agent' | 'device' | 'system' | string;

export interface ActorRef {
  id: string;
  role: ActorRole;
  sessionId: string;
  deviceId?: string;
  displayName?: string;
  metadata?: Record<string, unknown>;
}

export type ActorMessageEventType = 'actor.message' | 'message_start' | 'message_end';

export interface ActorMessageEvent<
  TMessage,
  TType extends ActorMessageEventType = ActorMessageEventType,
> {
  type: TType;
  eventId: string;
  sessionId: string;
  session: AgentSessionRef;
  actor: ActorRef;
  message: TMessage;
  timestamp: number;
  source?: Record<string, unknown>;
}

export interface HarnessContext<TMessage> {
  messages: TMessage[];
}

export interface HarnessTurnContext<TMessage> {
  messages: TMessage[];
  sourceMessages: TMessage[];
}

export type HarnessTurnRunner<TMessage> = (
  context: HarnessTurnContext<TMessage>,
  signal?: AbortSignal,
) => Promise<TMessage>;

export interface HarnessLoopConfig<TMessage> {
  runTurn: HarnessTurnRunner<TMessage>;
  transformContext?: (messages: TMessage[], signal?: AbortSignal) => Promise<TMessage[]>;
  getSteeringMessages?: () => Promise<TMessage[]>;
  getFollowUpMessages?: () => Promise<TMessage[]>;
  session?: AgentSessionRef;
  resolveMessageActor?: (message: TMessage, session: AgentSessionRef) => ActorRef;
  hooks?: HookRegistry;
}

export type HarnessEvent<TMessage> =
  | { type: 'agent_start' }
  | { type: 'agent_end'; messages: TMessage[] }
  | { type: 'turn_start' }
  | { type: 'turn_end'; message: TMessage }
  | ActorMessageEvent<TMessage, 'message_start'>
  | ActorMessageEvent<TMessage, 'message_end'>;

export type HarnessEventSink<TMessage> = (event: HarnessEvent<TMessage>) => Promise<void> | void;

export interface HarnessAgentState<TMessage> {
  messages: TMessage[];
  session: AgentSessionRef;
  isStreaming: boolean;
  streamingMessage?: TMessage;
  pendingOperations: ReadonlySet<string>;
  errorMessage?: string;
}

export interface HarnessAgentOptions<TMessage extends { role: string }> extends HarnessLoopConfig<TMessage> {
  initialState?: Partial<Pick<HarnessAgentState<TMessage>, 'messages'>>;
  createUserMessage: (content: string) => TMessage;
  steeringMode?: QueueMode;
  followUpMode?: QueueMode;
}

type ActiveRun = {
  abortController: AbortController;
  promise: Promise<void>;
};

export async function runHarnessLoop<TMessage>(
  prompts: TMessage[],
  context: HarnessContext<TMessage>,
  config: HarnessLoopConfig<TMessage>,
  emit: HarnessEventSink<TMessage>,
  signal?: AbortSignal,
): Promise<TMessage[]> {
  const session = normalizeSession(config.session);
  return withHarnessTelemetrySpan('harness.agent.loop', {
    attributes: {
      'agent.session.id': session.id,
      'agent.session.mode': session.mode as string,
      'agent.loop.prompt.count': prompts.length,
      'agent.loop.context.messages.count': context.messages.length,
    },
  }, (span) => runHarnessLoopBody(prompts, context, config, emit, session, span, signal));
}

async function runHarnessLoopBody<TMessage>(
  prompts: TMessage[],
  context: HarnessContext<TMessage>,
  config: HarnessLoopConfig<TMessage>,
  emit: HarnessEventSink<TMessage>,
  session: AgentSessionRef,
  telemetrySpan: Span,
  signal?: AbortSignal,
): Promise<TMessage[]> {
  const newMessages: TMessage[] = [];
  const resolveActor = config.resolveMessageActor ?? resolveDefaultMessageActor;
  const hooks = config.hooks;
  let eventIndex = 0;
  let turnCount = 0;
  let pendingMessages = [
    ...prompts,
    ...await drainMessages(config.getSteeringMessages),
  ];

  if (hooks) {
    await runHarnessHook(hooks, AGENT_LOOP_HOOK_EVENTS.loopStart, { prompts: pendingMessages, session }, signal);
  }
  await emit({ type: 'agent_start' });

  while (true) {
    if (hooks) {
      await runHarnessHook(hooks, AGENT_LOOP_HOOK_EVENTS.turnStart, { pendingMessages, session }, signal);
    }
    turnCount += 1;
    await emit({ type: 'turn_start' });
    for (const message of pendingMessages) {
      context.messages.push(message);
      newMessages.push(message);
      const startEvent = createActorMessageEvent('message_start', message, session, resolveActor, eventIndex++);
      if (hooks) {
        await runHarnessHook(hooks, AGENT_LOOP_HOOK_EVENTS.messageStart, startEvent, signal);
      }
      await emit(startEvent);
      const endEvent = createActorMessageEvent('message_end', message, session, resolveActor, eventIndex++);
      if (hooks) {
        await runHarnessHook(hooks, AGENT_LOOP_HOOK_EVENTS.messageEnd, endEvent, signal);
      }
      await emit(endEvent);
    }

    const sourceMessages = context.messages;
    const rawContextInput = {
      messages: [...sourceMessages],
      sourceMessages,
    };
    const contextInput = hooks
      ? await runHarnessHook(hooks, AGENT_LOOP_HOOK_EVENTS.contextInput, rawContextInput, signal)
      : rawContextInput;
    const transformedMessages = config.transformContext
      ? await config.transformContext(contextInput.messages, signal)
      : contextInput.messages;
    const rawContextOutput = {
      messages: transformedMessages,
      sourceMessages,
    };
    const contextOutput = hooks
      ? await runHarnessHook(hooks, AGENT_LOOP_HOOK_EVENTS.contextOutput, rawContextOutput, signal)
      : rawContextOutput;
    const rawLlmInput = {
      messages: contextOutput.messages,
      sourceMessages,
    };
    const llmInput = hooks
      ? await runHarnessHook(hooks, LLM_HOOK_EVENTS.input, rawLlmInput, signal)
      : rawLlmInput;
    const rawAssistantMessage = await withHarnessTelemetrySpan('harness.llm.run_turn', {
      kind: SpanKind.CLIENT,
      attributes: {
        'agent.session.id': session.id,
        'agent.session.mode': session.mode as string,
        'llm.input.messages.count': llmInput.messages.length,
        'llm.input.characters': sumMessageContentCharacters(llmInput.messages),
      },
    }, async (span) => {
      const message = await config.runTurn(llmInput, signal);
      span.setAttribute('llm.output.characters', sumMessageContentCharacters([message]));
      return message;
    });
    const rawLlmOutput = {
      message: rawAssistantMessage,
      messages: llmInput.messages,
      sourceMessages,
    };
    const llmOutput = hooks
      ? await runHarnessHook(hooks, LLM_HOOK_EVENTS.output, rawLlmOutput, signal)
      : rawLlmOutput;
    const assistantMessage = llmOutput.message;
    context.messages.push(assistantMessage);
    newMessages.push(assistantMessage);
    const assistantStartEvent = createActorMessageEvent('message_start', assistantMessage, session, resolveActor, eventIndex++);
    if (hooks) {
      await runHarnessHook(hooks, AGENT_LOOP_HOOK_EVENTS.messageStart, assistantStartEvent, signal);
    }
    await emit(assistantStartEvent);
    const assistantEndEvent = createActorMessageEvent('message_end', assistantMessage, session, resolveActor, eventIndex++);
    if (hooks) {
      await runHarnessHook(hooks, AGENT_LOOP_HOOK_EVENTS.messageEnd, assistantEndEvent, signal);
    }
    await emit(assistantEndEvent);
    if (hooks) {
      await runHarnessHook(hooks, AGENT_LOOP_HOOK_EVENTS.turnEnd, { message: assistantMessage, session }, signal);
    }
    await emit({ type: 'turn_end', message: assistantMessage });

    const rawSteeringMessages = {
      messages: await drainMessages(config.getSteeringMessages),
      session,
    };
    const steeringMessages = hooks
      ? await runHarnessHook(hooks, AGENT_LOOP_HOOK_EVENTS.steeringMessages, rawSteeringMessages, signal)
      : rawSteeringMessages;
    if (steeringMessages.messages.length > 0) {
      pendingMessages = steeringMessages.messages;
      continue;
    }

    const rawFollowUpMessages = {
      messages: await drainMessages(config.getFollowUpMessages),
      session,
    };
    const followUpMessages = hooks
      ? await runHarnessHook(hooks, AGENT_LOOP_HOOK_EVENTS.followUpMessages, rawFollowUpMessages, signal)
      : rawFollowUpMessages;
    if (followUpMessages.messages.length > 0) {
      pendingMessages = followUpMessages.messages;
      continue;
    }

    break;
  }

  if (hooks) {
    await runHarnessHook(hooks, AGENT_LOOP_HOOK_EVENTS.loopEnd, { messages: newMessages, session }, signal);
  }
  setHarnessTelemetryAttributes(telemetrySpan, {
    'agent.loop.turns': turnCount,
    'agent.loop.output.messages.count': newMessages.length,
  });
  await emit({ type: 'agent_end', messages: newMessages });
  return newMessages;
}

export class HarnessAgent<TMessage extends { role: string; content: string }> {
  private readonly steeringQueue: PendingMessageQueue<TMessage>;
  private readonly followUpQueue: PendingMessageQueue<TMessage>;
  private readonly listeners = new Set<(event: HarnessEvent<TMessage>, signal: AbortSignal) => Promise<void> | void>();
  private activeRun?: ActiveRun;
  private readonly stateValue: HarnessAgentState<TMessage>;

  public runTurn: HarnessTurnRunner<TMessage>;
  public transformContext?: (messages: TMessage[], signal?: AbortSignal) => Promise<TMessage[]>;

  constructor(private readonly options: HarnessAgentOptions<TMessage>) {
    this.stateValue = {
      messages: [...(options.initialState?.messages ?? [])],
      session: normalizeSession(options.session),
      isStreaming: false,
      pendingOperations: new Set<string>(),
    };
    this.runTurn = options.runTurn;
    this.transformContext = options.transformContext;
    this.steeringQueue = new PendingMessageQueue(options.steeringMode ?? 'one-at-a-time');
    this.followUpQueue = new PendingMessageQueue(options.followUpMode ?? 'one-at-a-time');
  }

  get state(): HarnessAgentState<TMessage> {
    return this.stateValue;
  }

  get signal(): AbortSignal | undefined {
    return this.activeRun?.abortController.signal;
  }

  get steeringMode(): QueueMode {
    return this.steeringQueue.mode;
  }

  set steeringMode(mode: QueueMode) {
    this.steeringQueue.mode = mode;
  }

  get followUpMode(): QueueMode {
    return this.followUpQueue.mode;
  }

  set followUpMode(mode: QueueMode) {
    this.followUpQueue.mode = mode;
  }

  subscribe(listener: (event: HarnessEvent<TMessage>, signal: AbortSignal) => Promise<void> | void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  steer(message: TMessage): void {
    this.steeringQueue.enqueue(message);
  }

  followUp(message: TMessage): void {
    this.followUpQueue.enqueue(message);
  }

  clearSteeringQueue(): void {
    this.steeringQueue.clear();
  }

  clearFollowUpQueue(): void {
    this.followUpQueue.clear();
  }

  clearAllQueues(): void {
    this.clearSteeringQueue();
    this.clearFollowUpQueue();
  }

  hasQueuedMessages(): boolean {
    return this.steeringQueue.hasItems() || this.followUpQueue.hasItems();
  }

  abort(): void {
    this.activeRun?.abortController.abort();
  }

  waitForIdle(): Promise<void> {
    return this.activeRun?.promise ?? Promise.resolve();
  }

  reset(): void {
    this.stateValue.messages = [];
    this.stateValue.isStreaming = false;
    this.stateValue.streamingMessage = undefined;
    this.stateValue.pendingOperations = new Set<string>();
    this.stateValue.errorMessage = undefined;
    this.clearAllQueues();
  }

  async prompt(input: string | TMessage | TMessage[]): Promise<void> {
    if (this.activeRun) {
      throw new Error('Agent is already processing a prompt.');
    }
    await this.runPromptMessages(this.normalizePromptInput(input));
  }

  async continue(): Promise<void> {
    if (this.activeRun) {
      throw new Error('Agent is already processing.');
    }

    const lastMessage = this.stateValue.messages.at(-1);
    if (lastMessage?.role === 'assistant') {
      const steeringMessages = this.steeringQueue.drain();
      if (steeringMessages.length > 0) {
        await this.runPromptMessages(steeringMessages);
        return;
      }

      const followUpMessages = this.followUpQueue.drain();
      if (followUpMessages.length > 0) {
        await this.runPromptMessages(followUpMessages);
        return;
      }

      throw new Error('Cannot continue from message role: assistant');
    }

    await this.runPromptMessages([]);
  }

  private normalizePromptInput(input: string | TMessage | TMessage[]): TMessage[] {
    if (typeof input === 'string') {
      return [this.options.createUserMessage(input)];
    }
    return Array.isArray(input) ? [...input] : [input];
  }

  private async runPromptMessages(messages: TMessage[]): Promise<void> {
    const abortController = new AbortController();
    const promise = runHarnessLoop(
      messages,
      { messages: this.stateValue.messages },
      {
        runTurn: this.runTurn,
        transformContext: this.transformContext,
        getSteeringMessages: async () => this.steeringQueue.drain(),
        getFollowUpMessages: async () => this.followUpQueue.drain(),
        session: this.stateValue.session,
        resolveMessageActor: this.options.resolveMessageActor,
        hooks: this.options.hooks,
      },
      (event) => this.processEvent(event, abortController.signal),
      abortController.signal,
    ).then(() => undefined).finally(() => {
      this.activeRun = undefined;
      this.stateValue.isStreaming = false;
      this.stateValue.streamingMessage = undefined;
    });

    this.activeRun = { abortController, promise };
    await promise;
  }

  private async processEvent(event: HarnessEvent<TMessage>, signal: AbortSignal): Promise<void> {
    this.applyEvent(event, signal);
    for (const listener of this.listeners) {
      await listener(event, signal);
    }
  }

  private applyEvent(event: HarnessEvent<TMessage>, signal: AbortSignal): void {
    if (event.type === 'agent_start') {
      this.stateValue.isStreaming = true;
      this.stateValue.errorMessage = undefined;
    }
    if (event.type === 'message_start' && event.message.role === 'assistant') {
      this.stateValue.streamingMessage = event.message;
    }
    if (event.type === 'message_end' && event.message.role === 'assistant') {
      this.stateValue.streamingMessage = undefined;
    }
    if (event.type === 'turn_end' && signal.aborted) {
      this.stateValue.errorMessage = 'aborted';
    }
  }
}

async function runHarnessHook<TPayload>(
  hooks: HookRegistry,
  event: HarnessHookEventDescriptor,
  payload: TPayload,
  signal?: AbortSignal,
): Promise<TPayload> {
  const options: HarnessHookRunOptions = {
    ...(signal !== undefined ? { signal } : {}),
  };
  return (await hooks.runEvent(event, payload, options)).payload;
}

async function drainMessages<TMessage>(drain?: () => Promise<TMessage[]>): Promise<TMessage[]> {
  return drain ? drain() : [];
}

export function normalizeSession(session?: AgentSessionRef): AgentSessionRef {
  return {
    id: session?.id ?? 'local',
    mode: session?.mode ?? 'local',
    ...(session?.metadata !== undefined ? { metadata: session.metadata } : {}),
  };
}

export function resolveDefaultMessageActor<TMessage>(
  message: TMessage,
  session: AgentSessionRef,
): ActorRef {
  const role = getMessageRole(message);
  if (role === 'assistant') {
    return { id: 'agent', role: 'agent', sessionId: session.id };
  }
  if (role === 'system') {
    return { id: 'system', role: 'system', sessionId: session.id };
  }
  return { id: 'user', role: 'user', sessionId: session.id };
}

export function createActorMessageEvent<TMessage, TType extends ActorMessageEventType>(
  type: TType,
  message: TMessage,
  session: AgentSessionRef,
  resolveActor: (message: TMessage, session: AgentSessionRef) => ActorRef,
  eventIndex: number,
  source?: Record<string, unknown>,
): ActorMessageEvent<TMessage, TType> {
  return {
    type,
    eventId: `${session.id}:${type}:${eventIndex}`,
    sessionId: session.id,
    session,
    actor: resolveActor(message, session),
    message,
    timestamp: getMessageTimestamp(message),
    ...(source !== undefined ? { source } : {}),
  };
}

function getMessageRole(message: unknown): string | undefined {
  return typeof message === 'object' && message !== null && 'role' in message
    ? String((message as { role?: unknown }).role)
    : undefined;
}

function getMessageTimestamp(message: unknown): number {
  const timestamp = typeof message === 'object' && message !== null && 'timestamp' in message
    ? (message as { timestamp?: unknown }).timestamp
    : undefined;
  return typeof timestamp === 'number' ? timestamp : Date.now();
}

function sumMessageContentCharacters(messages: readonly unknown[]): number {
  return messages.reduce<number>((total, message) => total + messageContentCharacters(message), 0);
}

function messageContentCharacters(message: unknown): number {
  if (typeof message !== 'object' || message === null || !('content' in message)) {
    return 0;
  }
  const content = (message as { content?: unknown }).content;
  return typeof content === 'string' ? content.length : 0;
}
