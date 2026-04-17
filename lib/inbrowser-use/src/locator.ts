import type {
  PlaywrightLikeLocator,
  PlaywrightLikeFrameLocator,
  QueryRoot,
  QueryStep,
  ResolvedNode,
  RoleOptions,
  TextOptions,
  ClickOptions,
  FillOptions,
  PressOptions,
  PressSequentiallyOptions,
  HoverOptions,
  ActionOptions,
  TimeoutOnly,
  SelectOptionArg,
  WaitForOptions,
  RootGetter,
} from './types.js';
import type { Runtime } from './runtime.js';
import {
  StrictModeViolationError,
  TimeoutError,
  UnsupportedError,
  FrameNotFoundError,
  FrameNotCooperativeError,
} from './errors.js';
import { sleep } from './runtime.js';
import { sendFrameAction, sendFrameQuery, getSameOriginFrameDocument } from './frameRpc.js';

// ---------------------------------------------------------------------------
// Description helpers
// ---------------------------------------------------------------------------

export function describeSteps(steps: QueryStep[]): string {
  if (steps.length === 0) return 'locator()';
  return steps
    .map((step) => {
      switch (step.kind) {
        case 'css':
          return `locator(${JSON.stringify(step.selector)})`;
        case 'role':
          return `getByRole(${step.role}${step.options?.name ? `, name=${String(step.options.name)}` : ''})`;
        case 'text':
          return `getByText(${String(step.text)})`;
        case 'label':
          return `getByLabel(${String(step.text)})`;
        case 'placeholder':
          return `getByPlaceholder(${String(step.text)})`;
        case 'testid':
          return `getByTestId(${String(step.id)})`;
        case 'filter':
          return 'filter()';
        case 'nth':
          return `nth(${step.index})`;
        case 'first':
          return 'first()';
        case 'last':
          return 'last()';
        default:
          return 'unknown';
      }
    })
    .join('.');
}

// ---------------------------------------------------------------------------
// Frame root resolution helper (shared by InAppLocator & InAppFrameLocator)
// ---------------------------------------------------------------------------

async function resolveFrameRoot(
  runtime: Runtime,
  parentRoot: QueryRoot,
  frameSteps: QueryStep[],
): Promise<QueryRoot> {
  const nodes = await runtime.queryEngine.resolveAll(parentRoot, frameSteps);

  if (nodes.length === 0) {
    throw new FrameNotFoundError(describeSteps(frameSteps));
  }
  if (nodes.length > 1) {
    throw new StrictModeViolationError(
      `frameLocator(${describeSteps(frameSteps)})`,
      nodes.length,
    );
  }

  const el = nodes[0].element;
  if (!(el instanceof HTMLIFrameElement)) {
    throw new FrameNotFoundError(describeSteps(frameSteps));
  }

  // Try same-origin first
  try {
    const frameDoc = getSameOriginFrameDocument(el);
    return { kind: 'same-origin-frame', iframe: el, document: frameDoc };
  } catch {
    // Cross-origin — check for a registered cooperative channel
    const channel = runtime.frameChannels.getForIframe(el);
    if (!channel) {
      throw new FrameNotCooperativeError(describeSteps(frameSteps));
    }
    return { kind: 'remote-frame', channel };
  }
}

// ---------------------------------------------------------------------------
// InAppLocator
// ---------------------------------------------------------------------------

export class InAppLocator implements PlaywrightLikeLocator {
  readonly _description: string;

  constructor(
    private readonly _runtime: Runtime,
    private readonly _rootGetter: RootGetter,
    private readonly _steps: QueryStep[],
    description?: string,
  ) {
    this._description = description ?? describeSteps(_steps);
  }

  // ---- Builder helpers ----

  private _chain(step: QueryStep, desc?: string): InAppLocator {
    return new InAppLocator(
      this._runtime,
      this._rootGetter,
      [...this._steps, step],
      desc,
    );
  }

  // ---- Locator factory methods ----

  locator(selector: string): InAppLocator {
    return this._chain({ kind: 'css', selector });
  }

  getByRole(role: string, options?: RoleOptions): InAppLocator {
    return this._chain({ kind: 'role', role, options });
  }

  getByText(text: string | RegExp, options?: TextOptions): InAppLocator {
    return this._chain({ kind: 'text', text, options });
  }

  getByLabel(text: string | RegExp, options?: TextOptions): InAppLocator {
    return this._chain({ kind: 'label', text, options });
  }

  getByPlaceholder(text: string | RegExp, options?: TextOptions): InAppLocator {
    return this._chain({ kind: 'placeholder', text });
  }

  getByTestId(id: string | RegExp): InAppLocator {
    return this._chain({ kind: 'testid', id });
  }

  frameLocator(selector: string): InAppFrameLocator {
    const parentRootGetter = this._rootGetter;
    const parentSteps = this._steps;
    const runtime = this._runtime;
    const frameRootGetter: RootGetter = async () => {
      const parentRoot = await parentRootGetter();
      return resolveFrameRoot(runtime, parentRoot, [
        ...parentSteps,
        { kind: 'css', selector },
      ]);
    };
    return new InAppFrameLocator(this._runtime, frameRootGetter);
  }

  filter(options: { hasText?: string | RegExp; has?: PlaywrightLikeLocator }): InAppLocator {
    const has =
      options.has instanceof InAppLocator ? options.has._steps : undefined;
    return this._chain({ kind: 'filter', hasText: options.hasText, has });
  }

  nth(index: number): InAppLocator {
    return this._chain({ kind: 'nth', index });
  }

  first(): InAppLocator {
    return this._chain({ kind: 'first' });
  }

  last(): InAppLocator {
    return this._chain({ kind: 'last' });
  }

  // ---- Actions ----

  async click(options?: ClickOptions): Promise<void> {
    const timeout = options?.timeout ?? this._runtime.defaultTimeoutMs;
    this._runtime.logger.info?.('action:click', { locator: this._description });

    await this._runtime.retry(async () => {
      await this._runtime.runLocatorHandlers();
      await this._runtime.stability.waitForStableUI({
        frames: this._runtime.stableFrames,
        quietDomMs: this._runtime.quietDomMs,
      });

      const root = await this._rootGetter();

      if (root.kind === 'remote-frame') {
        if (options?.trial) return;
        await sendFrameAction(
          root.channel,
          { steps: this._steps },
          { type: 'click', options },
          timeout,
        );
        return;
      }

      const node = await this._runtime.resolveStrict(
        root,
        this._steps,
        this._description,
        timeout,
      );
      this._runtime.actionability.ensureActionable(node.element, { force: options?.force });
      if (options?.trial) return;
      await this._runtime.executor.click(node.element, options);
    }, timeout);
  }

  async fill(value: string, options?: FillOptions): Promise<void> {
    const timeout = options?.timeout ?? this._runtime.defaultTimeoutMs;
    this._runtime.logger.info?.('action:fill', { locator: this._description, value });

    await this._runtime.retry(async () => {
      await this._runtime.stability.waitForStableUI({ frames: this._runtime.stableFrames });
      const root = await this._rootGetter();

      if (root.kind === 'remote-frame') {
        await sendFrameAction(
          root.channel,
          { steps: this._steps },
          { type: 'fill', options: { value, ...options } },
          timeout,
        );
        return;
      }

      const node = await this._runtime.resolveStrict(
        root,
        this._steps,
        this._description,
        timeout,
      );
      this._runtime.actionability.ensureActionable(node.element, { force: options?.force });
      await this._runtime.executor.fill(node.element, value, options);
    }, timeout);
  }

  async press(key: string, options?: PressOptions): Promise<void> {
    const timeout = options?.timeout ?? this._runtime.defaultTimeoutMs;
    await this._runtime.retry(async () => {
      const root = await this._rootGetter();
      if (root.kind === 'remote-frame') {
        await sendFrameAction(
          root.channel,
          { steps: this._steps },
          { type: 'press', options: { key, ...options } },
          timeout,
        );
        return;
      }
      const node = await this._runtime.resolveStrict(
        root,
        this._steps,
        this._description,
        timeout,
      );
      await this._runtime.executor.press(node.element, key, options);
    }, timeout);
  }

  async pressSequentially(text: string, options?: PressSequentiallyOptions): Promise<void> {
    const timeout = options?.timeout ?? this._runtime.defaultTimeoutMs;
    await this._runtime.retry(async () => {
      const root = await this._rootGetter();
      if (root.kind === 'remote-frame') {
        await sendFrameAction(
          root.channel,
          { steps: this._steps },
          { type: 'pressSequentially', options: { text, ...options } },
          timeout,
        );
        return;
      }
      const node = await this._runtime.resolveStrict(
        root,
        this._steps,
        this._description,
        timeout,
      );
      await this._runtime.executor.pressSequentially(node.element, text, options);
    }, timeout);
  }

  async focus(options?: TimeoutOnly): Promise<void> {
    const timeout = options?.timeout ?? this._runtime.defaultTimeoutMs;
    await this._runtime.retry(async () => {
      const root = await this._rootGetter();
      if (root.kind === 'remote-frame') {
        await sendFrameAction(
          root.channel,
          { steps: this._steps },
          { type: 'focus', options },
          timeout,
        );
        return;
      }
      const node = await this._runtime.resolveStrict(
        root,
        this._steps,
        this._description,
        timeout,
      );
      await this._runtime.executor.focus(node.element);
    }, timeout);
  }

  async blur(options?: TimeoutOnly): Promise<void> {
    const timeout = options?.timeout ?? this._runtime.defaultTimeoutMs;
    await this._runtime.retry(async () => {
      const root = await this._rootGetter();
      if (root.kind === 'remote-frame') {
        await sendFrameAction(
          root.channel,
          { steps: this._steps },
          { type: 'blur', options },
          timeout,
        );
        return;
      }
      const node = await this._runtime.resolveStrict(
        root,
        this._steps,
        this._description,
        timeout,
      );
      await this._runtime.executor.blur(node.element);
    }, timeout);
  }

  async hover(options?: HoverOptions): Promise<void> {
    const timeout = options?.timeout ?? this._runtime.defaultTimeoutMs;
    await this._runtime.retry(async () => {
      const root = await this._rootGetter();
      if (root.kind === 'remote-frame') {
        await sendFrameAction(
          root.channel,
          { steps: this._steps },
          { type: 'hover', options },
          timeout,
        );
        return;
      }
      const node = await this._runtime.resolveStrict(
        root,
        this._steps,
        this._description,
        timeout,
      );
      this._runtime.actionability.ensureActionable(node.element, { force: options?.force });
      await this._runtime.executor.hover(node.element, options);
    }, timeout);
  }

  async check(options?: ActionOptions): Promise<void> {
    const timeout = options?.timeout ?? this._runtime.defaultTimeoutMs;
    await this._runtime.retry(async () => {
      const root = await this._rootGetter();
      if (root.kind === 'remote-frame') {
        await sendFrameAction(
          root.channel,
          { steps: this._steps },
          { type: 'check', options },
          timeout,
        );
        return;
      }
      const node = await this._runtime.resolveStrict(
        root,
        this._steps,
        this._description,
        timeout,
      );
      this._runtime.actionability.ensureActionable(node.element, { force: options?.force });
      await this._runtime.executor.check(node.element, options);
    }, timeout);
  }

  async uncheck(options?: ActionOptions): Promise<void> {
    const timeout = options?.timeout ?? this._runtime.defaultTimeoutMs;
    await this._runtime.retry(async () => {
      const root = await this._rootGetter();
      if (root.kind === 'remote-frame') {
        await sendFrameAction(
          root.channel,
          { steps: this._steps },
          { type: 'uncheck', options },
          timeout,
        );
        return;
      }
      const node = await this._runtime.resolveStrict(
        root,
        this._steps,
        this._description,
        timeout,
      );
      this._runtime.actionability.ensureActionable(node.element, { force: options?.force });
      await this._runtime.executor.uncheck(node.element, options);
    }, timeout);
  }

  async selectOption(value: SelectOptionArg): Promise<void> {
    await this._runtime.retry(async () => {
      const root = await this._rootGetter();
      if (root.kind === 'remote-frame') {
        await sendFrameAction(
          root.channel,
          { steps: this._steps },
          { type: 'selectOption', options: { value } },
          this._runtime.defaultTimeoutMs,
        );
        return;
      }
      const node = await this._runtime.resolveStrict(root, this._steps, this._description);
      await this._runtime.executor.selectOption(node.element, value);
    });
  }

  async scrollIntoViewIfNeeded(options?: TimeoutOnly): Promise<void> {
    await this._runtime.retry(async () => {
      const root = await this._rootGetter();
      if (root.kind === 'remote-frame') {
        await sendFrameAction(
          root.channel,
          { steps: this._steps },
          { type: 'scrollIntoViewIfNeeded', options },
          this._runtime.defaultTimeoutMs,
        );
        return;
      }
      const node = await this._runtime.resolveStrict(root, this._steps, this._description);
      await this._runtime.executor.scrollIntoViewIfNeeded(node.element);
    }, options?.timeout);
  }

  // ---- Queries ----

  async getAttribute(name: string, options?: TimeoutOnly): Promise<string | null> {
    const node = await this._resolveNode(options?.timeout);
    return node.element.getAttribute(name);
  }

  async textContent(options?: TimeoutOnly): Promise<string | null> {
    const node = await this._resolveNode(options?.timeout);
    return node.element.textContent;
  }

  async inputValue(options?: TimeoutOnly): Promise<string> {
    const node = await this._resolveNode(options?.timeout);
    const el = node.element;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value;
    if (el instanceof HTMLSelectElement) return el.value;
    return el.textContent ?? '';
  }

  async isVisible(options?: TimeoutOnly): Promise<boolean> {
    try {
      const root = await this._rootGetter();
      if (root.kind === 'remote-frame') {
        return sendFrameQuery<boolean>(
          root.channel,
          { steps: this._steps },
          { type: 'isVisible' },
          options?.timeout ?? this._runtime.defaultTimeoutMs,
        );
      }
      const nodes = await this._runtime.queryEngine.resolveAll(root, this._steps);
      if (nodes.length === 0) return false;
      if (nodes.length > 1)
        throw new StrictModeViolationError(this._description, nodes.length);
      return this._runtime.actionability.isVisible(nodes[0].element);
    } catch (err) {
      if (err instanceof StrictModeViolationError) throw err;
      return false;
    }
  }

  async isEnabled(options?: TimeoutOnly): Promise<boolean> {
    try {
      const root = await this._rootGetter();
      if (root.kind === 'remote-frame') {
        return sendFrameQuery<boolean>(
          root.channel,
          { steps: this._steps },
          { type: 'isEnabled' },
          options?.timeout ?? this._runtime.defaultTimeoutMs,
        );
      }
      const nodes = await this._runtime.queryEngine.resolveAll(root, this._steps);
      if (nodes.length === 0) return false;
      if (nodes.length > 1)
        throw new StrictModeViolationError(this._description, nodes.length);
      return this._runtime.actionability.isEnabled(nodes[0].element);
    } catch (err) {
      if (err instanceof StrictModeViolationError) throw err;
      return false;
    }
  }

  async count(): Promise<number> {
    const root = await this._rootGetter();
    if (root.kind === 'remote-frame') {
      return sendFrameQuery<number>(
        root.channel,
        { steps: this._steps },
        { type: 'count' },
        this._runtime.defaultTimeoutMs,
      );
    }
    const nodes = await this._runtime.queryEngine.resolveAll(root, this._steps);
    return nodes.length;
  }

  async waitFor(options?: WaitForOptions): Promise<void> {
    const state = options?.state ?? 'visible';
    const timeout = options?.timeout ?? this._runtime.defaultTimeoutMs;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      try {
        const root = await this._rootGetter();
        if (root.kind !== 'remote-frame') {
          const nodes = await this._runtime.queryEngine.resolveAll(root, this._steps);
          if (state === 'detached' && nodes.length === 0) return;
          if (state === 'attached' && nodes.length > 0) return;
          if (
            state === 'visible' &&
            nodes.length > 0 &&
            this._runtime.actionability.isVisible(nodes[0].element)
          )
            return;
          if (
            state === 'hidden' &&
            (nodes.length === 0 ||
              !this._runtime.actionability.isVisible(nodes[0].element))
          )
            return;
        }
      } catch { /* transient */ }
      await sleep(50);
    }

    throw new TimeoutError(`waitFor(${state}) - ${this._description}`, timeout);
  }

  async evaluate<R, A = HTMLElement>(fn: (el: A) => R, _arg?: unknown): Promise<R> {
    const root = await this._rootGetter();
    if (root.kind === 'remote-frame') {
      throw new UnsupportedError(
        'evaluate() is not supported for remote cross-origin frames in v1',
      );
    }
    const node = await this._runtime.resolveStrict(
      root,
      this._steps,
      this._description,
    );
    return fn(node.element as unknown as A);
  }

  describe(): string {
    return this._description;
  }

  /** Expose steps for filter().has chaining */
  get _steps_public(): QueryStep[] {
    return this._steps;
  }

  private async _resolveNode(timeout?: number): Promise<ResolvedNode> {
    const root = await this._rootGetter();
    if (root.kind === 'remote-frame') {
      throw new UnsupportedError('Cannot resolve element in remote frame directly');
    }
    return this._runtime.resolveStrict(
      root,
      this._steps,
      this._description,
      timeout,
    );
  }
}

// ---------------------------------------------------------------------------
// InAppFrameLocator
// ---------------------------------------------------------------------------

export class InAppFrameLocator implements PlaywrightLikeFrameLocator {
  constructor(
    private readonly _runtime: Runtime,
    /** A getter that resolves the QueryRoot for this frame. */
    private readonly _frameRootGetter: RootGetter,
  ) {}

  private _locator(steps: QueryStep[]): InAppLocator {
    return new InAppLocator(this._runtime, this._frameRootGetter, steps);
  }

  locator(selector: string): InAppLocator {
    return this._locator([{ kind: 'css', selector }]);
  }

  getByRole(role: string, options?: RoleOptions): InAppLocator {
    return this._locator([{ kind: 'role', role, options }]);
  }

  getByText(text: string | RegExp, options?: TextOptions): InAppLocator {
    return this._locator([{ kind: 'text', text, options }]);
  }

  getByLabel(text: string | RegExp, options?: TextOptions): InAppLocator {
    return this._locator([{ kind: 'label', text, options }]);
  }

  getByPlaceholder(text: string | RegExp, options?: TextOptions): InAppLocator {
    return this._locator([{ kind: 'placeholder', text }]);
  }

  getByTestId(id: string | RegExp): InAppLocator {
    return this._locator([{ kind: 'testid', id }]);
  }

  frameLocator(selector: string): InAppFrameLocator {
    const parentGetter = this._frameRootGetter;
    const runtime = this._runtime;
    const nestedGetter: RootGetter = async () => {
      const parentRoot = await parentGetter();
      return resolveFrameRoot(runtime, parentRoot, [{ kind: 'css', selector }]);
    };
    return new InAppFrameLocator(this._runtime, nestedGetter);
  }
}
