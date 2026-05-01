export interface MemoryMessage {
  content: string;
  [key: string]: unknown;
}

export interface Memory<TMessage extends MemoryMessage = MemoryMessage> {
  messages: TMessage[];
  metadata: Record<string, unknown>;
}

export type MemoryOperation = 'prepare' | 'compact' | 'summarize' | 'observe' | string;

export interface ResolveLogActInputOptions<TMessage extends MemoryMessage = MemoryMessage> {
  messages: readonly TMessage[];
  input?: string;
}

export interface MemoryStrategyContext<TMessage extends MemoryMessage = MemoryMessage> {
  operation: MemoryOperation;
  memory: Memory<TMessage>;
  messages: readonly TMessage[];
  metadata: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface MemoryStrategyResult<TMessage extends MemoryMessage = MemoryMessage> {
  messages?: readonly TMessage[];
  metadata?: Record<string, unknown>;
  summary?: string;
  observations?: readonly unknown[];
}

export interface MemoryStrategy<TMessage extends MemoryMessage = MemoryMessage> {
  id: string;
  operation: MemoryOperation;
  priority?: number;
  run: (
    context: MemoryStrategyContext<TMessage>,
  ) => Promise<MemoryStrategyResult<TMessage> | void> | MemoryStrategyResult<TMessage> | void;
}

export interface MemoryRunOptions {
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface MemoryRunResult<TMessage extends MemoryMessage = MemoryMessage> {
  memory: Memory<TMessage>;
  summaries: string[];
  observations: unknown[];
}

type RegisteredMemoryStrategy<TMessage extends MemoryMessage> = {
  strategy: MemoryStrategy<TMessage>;
  order: number;
};

export class MemoryRegistry<TMessage extends MemoryMessage = MemoryMessage> {
  private readonly strategies = new Map<string, RegisteredMemoryStrategy<TMessage>>();
  private nextOrder = 0;

  register(strategy: MemoryStrategy<TMessage>): void {
    if (this.strategies.has(strategy.id)) {
      throw new Error(`Memory strategy already registered: ${strategy.id}`);
    }
    this.strategies.set(strategy.id, { strategy, order: this.nextOrder });
    this.nextOrder += 1;
  }

  get(id: string): MemoryStrategy<TMessage> | undefined {
    return this.strategies.get(id)?.strategy;
  }

  list(): MemoryStrategy<TMessage>[] {
    return [...this.strategies.values()].map((entry) => entry.strategy);
  }

  forOperation(operation: MemoryOperation): MemoryStrategy<TMessage>[] {
    return [...this.strategies.values()]
      .filter((entry) => entry.strategy.operation === operation)
      .sort((left, right) => {
        const priorityDelta = (left.strategy.priority ?? 0) - (right.strategy.priority ?? 0);
        return priorityDelta || left.order - right.order;
      })
      .map((entry) => entry.strategy);
  }

  async run(
    operation: MemoryOperation,
    memory: Memory<TMessage>,
    options: MemoryRunOptions = {},
  ): Promise<MemoryRunResult<TMessage>> {
    const workingMemory: Memory<TMessage> = {
      messages: [...memory.messages],
      metadata: { ...memory.metadata },
    };
    const summaries: string[] = [];
    const observations: unknown[] = [];

    for (const strategy of this.forOperation(operation)) {
      const result = await strategy.run({
        operation,
        memory: workingMemory,
        messages: workingMemory.messages,
        metadata: { ...workingMemory.metadata, ...(options.metadata ?? {}) },
        signal: options.signal,
      });
      if (!result) continue;
      if (result.messages) workingMemory.messages = [...result.messages];
      if (result.metadata) workingMemory.metadata = { ...workingMemory.metadata, ...result.metadata };
      if (result.summary) summaries.push(result.summary);
      if (result.observations) observations.push(...result.observations);
    }

    return {
      memory: workingMemory,
      summaries,
      observations,
    };
  }
}

export function createMemory<TMessage extends MemoryMessage>(
  messages: readonly TMessage[] = [],
): Memory<TMessage> {
  return { messages: [...messages], metadata: {} };
}

export function appendMemoryMessage<TMessage extends MemoryMessage>(
  memory: Memory<TMessage>,
  message: TMessage,
): TMessage {
  memory.messages.push(message);
  return message;
}

export function resolveLogActInput<TMessage extends MemoryMessage>({
  messages,
  input,
}: ResolveLogActInputOptions<TMessage>): string {
  if (input !== undefined) return input;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const content = messages[index]?.content;
    if (content) return content;
  }
  return '';
}
