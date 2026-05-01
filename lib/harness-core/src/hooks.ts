export type HarnessHookKind = 'deterministic' | 'inference';
export type HarnessHookMode = 'middleware' | 'pipe';
export type HarnessHookPoint = string;

export interface HarnessHookEvent<TPayload> {
  point: HarnessHookPoint;
  payload: TPayload;
  metadata: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface HarnessHookResult<TPayload> {
  payload?: TPayload;
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
  kind: HarnessHookKind;
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

export interface HarnessHookRunResult<TPayload> {
  payload: TPayload;
  stopped: boolean;
  reason?: string;
  outputs: HarnessHookOutput[];
}

export interface HarnessHookMiddlewareRunResult<TPayload> {
  payload: TPayload;
  outputs: HarnessHookOutput[];
}

export interface HarnessHookPipeRunResult<TPayload> extends HarnessHookRunResult<TPayload> {
  canceled: boolean;
  bubbled: boolean;
}

type RegisteredHook<TPayload> = {
  hook: HarnessHook<TPayload>;
  order: number;
};

export class HookRegistry<TPayload = unknown> {
  private readonly hooks = new Map<string, RegisteredHook<TPayload>>();
  private nextOrder = 0;

  register(hook: HarnessHook<TPayload>): void {
    this.registerHook({ ...hook, mode: hook.mode ?? 'pipe' });
  }

  registerMiddleware(hook: Omit<HarnessHook<TPayload>, 'mode'>): void {
    this.registerHook({ ...hook, mode: 'middleware' });
  }

  registerPipe(hook: Omit<HarnessHook<TPayload>, 'mode'>): void {
    this.registerHook({ ...hook, mode: 'pipe' });
  }

  private registerHook(hook: HarnessHook<TPayload>): void {
    if (this.hooks.has(hook.id)) {
      throw new Error(`Hook already registered: ${hook.id}`);
    }
    this.hooks.set(hook.id, { hook, order: this.nextOrder });
    this.nextOrder += 1;
  }

  get(id: string): HarnessHook<TPayload> | undefined {
    return this.hooks.get(id)?.hook;
  }

  list(): HarnessHook<TPayload>[] {
    return [...this.hooks.values()].map((entry) => entry.hook);
  }

  forPoint(point: HarnessHookPoint, mode?: HarnessHookMode): HarnessHook<TPayload>[] {
    return [...this.hooks.values()]
      .filter((entry) => entry.hook.point === point && (mode === undefined || entry.hook.mode === mode))
      .sort((left, right) => {
        const priorityDelta = (left.hook.priority ?? 0) - (right.hook.priority ?? 0);
        return priorityDelta || left.order - right.order;
      })
      .map((entry) => entry.hook);
  }

  async runMiddleware(
    point: HarnessHookPoint,
    payload: TPayload,
    options: HarnessHookRunOptions = {},
  ): Promise<HarnessHookMiddlewareRunResult<TPayload>> {
    const metadata = options.metadata ?? {};
    const results = await Promise.all(this.forPoint(point, 'middleware').map(async (hook) => ({
      hook,
      result: await hook.run({
        point,
        payload,
        metadata,
        signal: options.signal,
      }),
    })));
    const outputs = results
      .filter(({ result }) => result && Object.prototype.hasOwnProperty.call(result, 'output'))
      .map(({ hook, result }) => ({ hookId: hook.id, output: result?.output }));

    return { payload, outputs };
  }

  async runPipes(
    point: HarnessHookPoint,
    payload: TPayload,
    options: HarnessHookRunOptions = {},
  ): Promise<HarnessHookPipeRunResult<TPayload>> {
    let currentPayload = payload;
    const outputs: HarnessHookOutput[] = [];
    const metadata = options.metadata ?? {};

    for (const hook of this.forPoint(point, 'pipe')) {
      const result = await hook.run({
        point,
        payload: currentPayload,
        metadata,
        signal: options.signal,
      });
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

  async run(
    point: HarnessHookPoint,
    payload: TPayload,
    options: HarnessHookRunOptions = {},
  ): Promise<HarnessHookRunResult<TPayload>> {
    const middleware = await this.runMiddleware(point, payload, options);
    const pipes = await this.runPipes(point, payload, options);
    const result = {
      payload: pipes.payload,
      stopped: pipes.stopped,
      outputs: [...middleware.outputs, ...pipes.outputs],
    };
    return pipes.reason === undefined ? result : { ...result, reason: pipes.reason };
  }
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
