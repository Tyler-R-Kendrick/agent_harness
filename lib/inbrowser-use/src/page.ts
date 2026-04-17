import type {
  PlaywrightLikePage,
  PlaywrightLikeLocator,
  RoleOptions,
  TextOptions,
  RootGetter,
} from './types.js';
import type { Runtime } from './runtime.js';
import { InAppLocator, InAppFrameLocator } from './locator.js';
import { TimeoutError } from './errors.js';
import { sleep } from './runtime.js';

export class InAppPage implements PlaywrightLikePage {
  /** The root locator used as a delegation base. Has empty steps. */
  private readonly _root: InAppLocator;

  constructor(
    private readonly _runtime: Runtime,
    doc?: Document,
  ) {
    const resolvedDoc = doc ?? (typeof document !== 'undefined' ? document : null);
    const rootGetter: RootGetter = () =>
      Promise.resolve({ kind: 'document', document: resolvedDoc! });
    this._root = new InAppLocator(this._runtime, rootGetter, []);
  }

  locator(selector: string): InAppLocator {
    return this._root.locator(selector);
  }

  getByRole(role: string, options?: RoleOptions): InAppLocator {
    return this._root.getByRole(role, options);
  }

  getByText(text: string | RegExp, options?: TextOptions): InAppLocator {
    return this._root.getByText(text, options);
  }

  getByLabel(text: string | RegExp, options?: TextOptions): InAppLocator {
    return this._root.getByLabel(text, options);
  }

  getByPlaceholder(text: string | RegExp, options?: TextOptions): InAppLocator {
    return this._root.getByPlaceholder(text, options);
  }

  getByTestId(id: string | RegExp): InAppLocator {
    return this._root.getByTestId(id);
  }

  frameLocator(selector: string): InAppFrameLocator {
    return this._root.frameLocator(selector);
  }

  async evaluate<R, A = unknown>(fn: (arg: A) => R, arg?: A): Promise<R> {
    return fn(arg as A);
  }

  async waitForFunction<R>(
    fn: () => R | Promise<R>,
    options?: { timeout?: number },
  ): Promise<R> {
    const timeout = options?.timeout ?? this._runtime.defaultTimeoutMs;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const result = await fn();
      if (result) return result;
      await sleep(50);
    }

    throw new TimeoutError('waitForFunction', timeout);
  }

  async waitForTimeout(ms: number): Promise<void> {
    await sleep(ms);
  }

  async addLocatorHandler(
    locator: PlaywrightLikeLocator,
    handler: () => Promise<void> | void,
  ): Promise<void> {
    this._runtime.addLocatorHandler(locator, handler);
  }
}
