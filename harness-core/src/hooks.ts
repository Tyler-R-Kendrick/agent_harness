import { withHarnessTelemetrySpan } from './telemetry.js';

export type HarnessHookKind = 'deterministic' | 'inference';
export type HarnessHookMode = 'middleware' | 'pipe';
export type HarnessHookFormat = 'code' | 'semantic';
export type HarnessHookEventType = 'llm' | 'agent' | 'harness' | 'system' | 'plugin';
export type HarnessHookPoint = string;

export interface HarnessHookEventDescriptor {
  type: HarnessHookEventType;
  name: string;
}

export interface HarnessHookEvent<TPayload> {
  point: HarnessHookPoint;
  event?: HarnessHookEventDescriptor;
  payload: TPayload;
  metadata: Record<string, unknown>;
  signal?: AbortSignal;
  semantic?: HarnessSemanticHook;
}

export interface HarnessHookResult<TPayload> {
  payload?: TPayload;
  pass?: boolean;
  cancel?: boolean;
  bubble?: boolean;
  stop?: boolean;
  reason?: string;
  output?: unknown;
}

export type HarnessHookRunner<TPayload> = (
  event: HarnessHookEvent<TPayload>,
) => Promise<HarnessHookResult<TPayload> | void> | HarnessHookResult<TPayload> | void;

export interface HarnessHook<TPayload = unknown> {
  id: string;
  point: HarnessHookPoint;
  event?: HarnessHookEventDescriptor;
  kind: HarnessHookKind;
  format?: HarnessHookFormat;
  prompt?: string;
  mode?: HarnessHookMode;
  priority?: number;
  run: HarnessHookRunner<TPayload>;
}

export interface HarnessHookRunOptions {
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface HarnessHookOutput {
  hookId: string;
  output: unknown;
}

export interface HarnessHookPolicyFailure {
  hookId: string;
  reason?: string;
}

export interface HarnessHookRunResult<TPayload> {
  payload: TPayload;
  stopped: boolean;
  reason?: string;
  outputs: HarnessHookOutput[];
}

export interface HarnessHookMiddlewareRunResult<TPayload> {
  payload: TPayload;
  outputs: HarnessHookOutput[];
  passed?: boolean;
  failures?: HarnessHookPolicyFailure[];
}

export interface HarnessHookPipeRunResult<TPayload> extends HarnessHookRunResult<TPayload> {
  canceled: boolean;
  bubbled: boolean;
}

type RegisteredHook = {
  hook: HarnessHook<unknown>;
  order: number;
};

export const LLM_HOOK_EVENTS = {
  input: { type: 'llm', name: 'input' },
  toolCall: { type: 'llm', name: 'tool-call' },
  output: { type: 'llm', name: 'output' },
} as const satisfies Record<string, HarnessHookEventDescriptor>;

export const AGENT_LOOP_HOOK_EVENTS = {
  loopStart: { type: 'harness', name: 'loop.start' },
  loopEnd: { type: 'harness', name: 'loop.end' },
  turnStart: { type: 'agent', name: 'turn.start' },
  turnEnd: { type: 'agent', name: 'turn.end' },
  messageStart: { type: 'agent', name: 'message.start' },
  messageEnd: { type: 'agent', name: 'message.end' },
  contextInput: { type: 'agent', name: 'context.input' },
  contextOutput: { type: 'agent', name: 'context.output' },
  steeringMessages: { type: 'agent', name: 'queue.steering' },
  followUpMessages: { type: 'agent', name: 'queue.follow-up' },
} as const satisfies Record<string, HarnessHookEventDescriptor>;

export const ACTOR_WORKFLOW_HOOK_EVENTS = {
  started: { type: 'agent', name: 'actor.workflow.started' },
  input: { type: 'agent', name: 'actor.workflow.input' },
  output: { type: 'agent', name: 'actor.workflow.output' },
  completed: { type: 'agent', name: 'actor.workflow.completed' },
  failed: { type: 'agent', name: 'actor.workflow.failed' },
} as const satisfies Record<string, HarnessHookEventDescriptor>;

export const AGENT_BUS_HOOK_EVENTS = {
  append: { type: 'agent', name: 'bus.append' },
  appendResult: { type: 'agent', name: 'bus.append.result' },
  read: { type: 'agent', name: 'bus.read' },
  readResult: { type: 'agent', name: 'bus.read.result' },
  tail: { type: 'agent', name: 'bus.tail' },
  tailResult: { type: 'agent', name: 'bus.tail.result' },
  poll: { type: 'agent', name: 'bus.poll' },
  pollResult: { type: 'agent', name: 'bus.poll.result' },
} as const satisfies Record<string, HarnessHookEventDescriptor>;

export const LOGACT_AGENT_LOOP_HOOK_EVENTS = {
  loopStart: { type: 'agent', name: 'logact.loop.start' },
  loopEnd: { type: 'agent', name: 'logact.loop.end' },
  workflowStart: { type: 'agent', name: 'logact.workflow.start' },
  workflowSnapshot: { type: 'agent', name: 'logact.workflow.snapshot' },
  triggerInput: { type: 'agent', name: 'logact.trigger.input' },
  triggerOutput: { type: 'agent', name: 'logact.trigger.output' },
  driverInput: { type: 'llm', name: 'logact.driver.input' },
  driverOutput: { type: 'llm', name: 'logact.driver.output' },
  voterInput: { type: 'agent', name: 'logact.voter.input' },
  voterOutput: { type: 'agent', name: 'logact.voter.output' },
  deciderInput: { type: 'agent', name: 'logact.decider.input' },
  deciderOutput: { type: 'agent', name: 'logact.decider.output' },
  executorInput: { type: 'llm', name: 'logact.executor.input' },
  executorOutput: { type: 'llm', name: 'logact.executor.output' },
  completionInput: { type: 'agent', name: 'logact.completion.input' },
  completionOutput: { type: 'agent', name: 'logact.completion.output' },
} as const satisfies Record<string, HarnessHookEventDescriptor>;

export interface HarnessSemanticHook {
  prompt: string;
}

export class HarnessHookPolicyError extends Error {
  constructor(
    message: string,
    public readonly failures: HarnessHookPolicyFailure[],
    public readonly outputs: HarnessHookOutput[],
  ) {
    super(message);
    this.name = 'HarnessHookPolicyError';
  }
}

export function hookPointForEvent(event: HarnessHookEventDescriptor): HarnessHookPoint {
  return `${event.type}:${event.name}`;
}

export class HookRegistry<TPayload = unknown> {
  private readonly hooks = new Map<string, RegisteredHook>();
  private nextOrder = 0;

  register<TSpecificPayload = TPayload>(hook: HarnessHook<TSpecificPayload>): void {
    this.registerHook({ ...hook, mode: hook.mode ?? 'pipe' } as HarnessHook<unknown>);
  }

  registerMiddleware<TSpecificPayload = TPayload>(hook: Omit<HarnessHook<TSpecificPayload>, 'mode'>): void {
    this.registerHook({ ...hook, mode: 'middleware' } as HarnessHook<unknown>);
  }

  registerPipe<TSpecificPayload = TPayload>(hook: Omit<HarnessHook<TSpecificPayload>, 'mode'>): void {
    this.registerHook({ ...hook, mode: 'pipe' } as HarnessHook<unknown>);
  }

  private registerHook(hook: HarnessHook<unknown>): void {
    if (this.hooks.has(hook.id)) {
      throw new Error(`Hook already registered: ${hook.id}`);
    }
    this.hooks.set(hook.id, { hook, order: this.nextOrder });
    this.nextOrder += 1;
  }

  get<TSpecificPayload = TPayload>(id: string): HarnessHook<TSpecificPayload> | undefined {
    return this.hooks.get(id)?.hook as HarnessHook<TSpecificPayload> | undefined;
  }

  list<TSpecificPayload = TPayload>(): HarnessHook<TSpecificPayload>[] {
    return [...this.hooks.values()].map((entry) => entry.hook as HarnessHook<TSpecificPayload>);
  }

  forPoint<TSpecificPayload = TPayload>(point: HarnessHookPoint, mode?: HarnessHookMode): HarnessHook<TSpecificPayload>[] {
    return [...this.hooks.values()]
      .filter((entry) => entry.hook.point === point && (mode === undefined || entry.hook.mode === mode))
      .sort((left, right) => {
        const priorityDelta = (left.hook.priority ?? 0) - (right.hook.priority ?? 0);
        return priorityDelta || left.order - right.order;
      })
      .map((entry) => entry.hook as HarnessHook<TSpecificPayload>);
  }

  forEvent<TSpecificPayload = TPayload>(
    event: HarnessHookEventDescriptor,
    mode?: HarnessHookMode,
  ): HarnessHook<TSpecificPayload>[] {
    return this.forPoint<TSpecificPayload>(hookPointForEvent(event), mode);
  }

  async runMiddleware<TSpecificPayload = TPayload>(
    point: HarnessHookPoint,
    payload: TSpecificPayload,
    options: HarnessHookRunOptions = {},
  ): Promise<HarnessHookMiddlewareRunResult<TSpecificPayload>> {
    return this.runMiddlewareInternal(point, payload, options);
  }

  async runMiddlewareForEvent<TSpecificPayload = TPayload>(
    event: HarnessHookEventDescriptor,
    payload: TSpecificPayload,
    options: HarnessHookRunOptions = {},
  ): Promise<HarnessHookMiddlewareRunResult<TSpecificPayload>> {
    return this.runMiddlewareInternal(hookPointForEvent(event), payload, options, event);
  }

  private async runMiddlewareInternal<TSpecificPayload>(
    point: HarnessHookPoint,
    payload: TSpecificPayload,
    options: HarnessHookRunOptions,
    event?: HarnessHookEventDescriptor,
  ): Promise<HarnessHookMiddlewareRunResult<TSpecificPayload>> {
    const metadata = options.metadata ?? {};
    const results = await Promise.all(this.forPoint<TSpecificPayload>(point, 'middleware').map(async (hook) => ({
      hook,
      result: await runHookWithTelemetry(hook, point, event, payload, metadata, options.signal),
    })));
    const outputs = results
      .filter(({ result }) => result && Object.prototype.hasOwnProperty.call(result, 'output'))
      .map(({ hook, result }) => ({ hookId: hook.id, output: result?.output }));
    const failures = results
      .filter(({ result }) => result?.pass === false || result?.cancel || result?.stop)
      .map(({ hook, result }) => ({
        hookId: hook.id,
        ...(result?.reason === undefined ? {} : { reason: result.reason }),
      }));

    if (failures.length > 0) {
      return { payload, outputs, passed: false, failures };
    }

    return { payload, outputs };
  }

  async runPipes<TSpecificPayload = TPayload>(
    point: HarnessHookPoint,
    payload: TSpecificPayload,
    options: HarnessHookRunOptions = {},
  ): Promise<HarnessHookPipeRunResult<TSpecificPayload>> {
    return this.runPipesInternal(point, payload, options);
  }

  async runPipesForEvent<TSpecificPayload = TPayload>(
    event: HarnessHookEventDescriptor,
    payload: TSpecificPayload,
    options: HarnessHookRunOptions = {},
  ): Promise<HarnessHookPipeRunResult<TSpecificPayload>> {
    return this.runPipesInternal(hookPointForEvent(event), payload, options, event);
  }

  private async runPipesInternal<TSpecificPayload>(
    point: HarnessHookPoint,
    payload: TSpecificPayload,
    options: HarnessHookRunOptions,
    event?: HarnessHookEventDescriptor,
  ): Promise<HarnessHookPipeRunResult<TSpecificPayload>> {
    let currentPayload = payload;
    const outputs: HarnessHookOutput[] = [];
    const metadata = options.metadata ?? {};

    for (const hook of this.forPoint<TSpecificPayload>(point, 'pipe')) {
      const result = await runHookWithTelemetry(hook, point, event, currentPayload, metadata, options.signal);
      if (!result) continue;
      if (result.payload !== undefined) currentPayload = result.payload;
      if (Object.prototype.hasOwnProperty.call(result, 'output')) {
        outputs.push({ hookId: hook.id, output: result.output });
      }
      if (result.cancel || result.stop || result.bubble) {
        const runResult = {
          payload: currentPayload,
          stopped: Boolean(result.cancel || result.stop),
          canceled: Boolean(result.cancel || result.stop),
          bubbled: Boolean(result.bubble && !result.cancel && !result.stop),
          outputs,
        };
        return result.reason === undefined ? runResult : { ...runResult, reason: result.reason };
      }
    }

    return {
      payload: currentPayload,
      stopped: false,
      canceled: false,
      bubbled: false,
      outputs,
    };
  }

  async run<TSpecificPayload = TPayload>(
    point: HarnessHookPoint,
    payload: TSpecificPayload,
    options: HarnessHookRunOptions = {},
  ): Promise<HarnessHookRunResult<TSpecificPayload>> {
    const middleware = await this.runMiddleware(point, payload, options);
    if (middleware.failures && middleware.failures.length > 0) {
      throw new HarnessHookPolicyError('One or more middleware hooks denied propagation.', middleware.failures, middleware.outputs);
    }
    const pipes = await this.runPipes(point, payload, options);
    const result = {
      payload: pipes.payload,
      stopped: pipes.stopped,
      outputs: [...middleware.outputs, ...pipes.outputs],
    };
    return pipes.reason === undefined ? result : { ...result, reason: pipes.reason };
  }

  async runEvent<TSpecificPayload = TPayload>(
    event: HarnessHookEventDescriptor,
    payload: TSpecificPayload,
    options: HarnessHookRunOptions = {},
  ): Promise<HarnessHookRunResult<TSpecificPayload>> {
    const middleware = await this.runMiddlewareForEvent(event, payload, options);
    if (middleware.failures && middleware.failures.length > 0) {
      throw new HarnessHookPolicyError('One or more middleware hooks denied propagation.', middleware.failures, middleware.outputs);
    }
    const pipes = await this.runPipesForEvent(event, payload, options);
    const result = {
      payload: pipes.payload,
      stopped: pipes.stopped,
      outputs: [...middleware.outputs, ...pipes.outputs],
    };
    return pipes.reason === undefined ? result : { ...result, reason: pipes.reason };
  }
}

export function createCodeHook<TPayload>({
  event,
  point,
  ...hook
}: Omit<HarnessHook<TPayload>, 'kind' | 'point' | 'format'> & {
  event?: HarnessHookEventDescriptor;
  point?: HarnessHookPoint;
}): HarnessHook<TPayload> {
  const hookPoint = point ?? (event ? hookPointForEvent(event) : undefined);
  if (!hookPoint) {
    throw new Error('Code hooks require either an event or point.');
  }
  return {
    ...hook,
    point: hookPoint,
    ...(event !== undefined ? { event } : {}),
    kind: 'deterministic',
    format: 'code',
  };
}

export function createSemanticHook<TPayload>({
  event,
  point,
  prompt,
  ...hook
}: Omit<HarnessHook<TPayload>, 'kind' | 'point' | 'format' | 'prompt'> & {
  event?: HarnessHookEventDescriptor;
  point?: HarnessHookPoint;
  prompt: string;
}): HarnessHook<TPayload> {
  const hookPoint = point ?? (event ? hookPointForEvent(event) : undefined);
  if (!hookPoint) {
    throw new Error('Semantic hooks require either an event or point.');
  }
  return {
    ...hook,
    point: hookPoint,
    ...(event !== undefined ? { event } : {}),
    kind: 'inference',
    format: 'semantic',
    prompt,
  };
}

export function createInferenceHook<TPayload>({
  id,
  point,
  priority,
  infer,
}: {
  id: string;
  point: HarnessHookPoint;
  priority?: number;
  infer: (event: HarnessHookEvent<TPayload>) => Promise<TPayload | undefined> | TPayload | undefined;
}): HarnessHook<TPayload> {
  return {
    id,
    point,
    kind: 'inference',
    priority,
    async run(event) {
      const payload = await infer(event);
      return payload === undefined ? undefined : { payload };
    },
  };
}

function semanticForHook<TPayload>(hook: HarnessHook<TPayload>): HarnessSemanticHook | undefined {
  return hook.format === 'semantic' && hook.prompt !== undefined
    ? { prompt: hook.prompt }
    : undefined;
}

async function runHookWithTelemetry<TPayload>(
  hook: HarnessHook<TPayload>,
  point: HarnessHookPoint,
  event: HarnessHookEventDescriptor | undefined,
  payload: TPayload,
  metadata: Record<string, unknown>,
  signal: AbortSignal | undefined,
): Promise<HarnessHookResult<TPayload> | void> {
  const hookEvent = event ?? hook.event;
  return withHarnessTelemetrySpan('harness.hook.run', {
    attributes: {
      'harness.hook.id': hook.id,
      'harness.hook.point': point,
      'harness.hook.mode': hook.mode as HarnessHookMode,
      'harness.hook.kind': hook.kind,
      ...(hook.format !== undefined ? { 'harness.hook.format': hook.format } : {}),
      ...(hook.priority !== undefined ? { 'harness.hook.priority': hook.priority } : {}),
      ...(hookEvent !== undefined
        ? {
          'harness.hook.event.type': hookEvent.type,
          'harness.hook.event.name': hookEvent.name,
        }
        : {}),
    },
  }, async (span) => {
    const result = await hook.run({
      point,
      event: hookEvent,
      payload,
      metadata,
      signal,
      semantic: semanticForHook(hook),
    });
    if (result?.pass !== undefined) {
      span.setAttribute('harness.hook.result.pass', result.pass);
    }
    if (result?.cancel !== undefined) {
      span.setAttribute('harness.hook.result.cancel', result.cancel);
    }
    if (result?.stop !== undefined) {
      span.setAttribute('harness.hook.result.stop', result.stop);
    }
    if (result?.bubble !== undefined) {
      span.setAttribute('harness.hook.result.bubble', result.bubble);
    }
    return result;
  });
}
