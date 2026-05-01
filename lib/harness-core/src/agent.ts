import { PendingMessageQueue, type QueueMode } from './queue.js';

export interface HarnessMessage {
  role: string;
  content: string;
  timestamp: number;
  [key: string]: unknown;
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
}

export type HarnessEvent<TMessage> =
  | { type: 'agent_start' }
  | { type: 'agent_end'; messages: TMessage[] }
  | { type: 'turn_start' }
  | { type: 'turn_end'; message: TMessage }
  | { type: 'message_start'; message: TMessage }
  | { type: 'message_end'; message: TMessage };

export type HarnessEventSink<TMessage> = (event: HarnessEvent<TMessage>) => Promise<void> | void;

export interface HarnessAgentState<TMessage> {
  messages: TMessage[];
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
  const newMessages: TMessage[] = [];
  let pendingMessages = [
    ...prompts,
    ...await drainMessages(config.getSteeringMessages),
  ];

  await emit({ type: 'agent_start' });

  while (true) {
    await emit({ type: 'turn_start' });
    for (const message of pendingMessages) {
      context.messages.push(message);
      newMessages.push(message);
      await emit({ type: 'message_start', message });
      await emit({ type: 'message_end', message });
    }

    const sourceMessages = context.messages;
    const messages = config.transformContext
      ? await config.transformContext([...sourceMessages], signal)
      : sourceMessages;
    const assistantMessage = await config.runTurn({ messages, sourceMessages }, signal);
    context.messages.push(assistantMessage);
    newMessages.push(assistantMessage);
    await emit({ type: 'message_start', message: assistantMessage });
    await emit({ type: 'message_end', message: assistantMessage });
    await emit({ type: 'turn_end', message: assistantMessage });

    const steeringMessages = await drainMessages(config.getSteeringMessages);
    if (steeringMessages.length > 0) {
      pendingMessages = steeringMessages;
      continue;
    }

    const followUpMessages = await drainMessages(config.getFollowUpMessages);
    if (followUpMessages.length > 0) {
      pendingMessages = followUpMessages;
      continue;
    }

    break;
  }

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

async function drainMessages<TMessage>(drain?: () => Promise<TMessage[]>): Promise<TMessage[]> {
  return drain ? drain() : [];
}
