import type {
  CreateInAppPageOptions,
  QueryRoot,
  QueryStep,
  ResolvedNode,
  AgentLogger,
  UserActivationBroker,
  AgentRegistryInterface,
  FrameChannelRegistry,
  PlaywrightLikeLocator,
} from './types.js';
import { QueryEngine } from './queryEngine.js';
import { ActionabilityEngine } from './actionability.js';
import { StabilityManager } from './stability.js';
import { ActionExecutor } from './actionExecutor.js';
import { AgentRegistry } from './registry.js';
import { DefaultActivationBroker } from './activation.js';
import { DefaultFrameChannelRegistry } from './frameRpc.js';
import {
  StrictModeViolationError,
  TimeoutError,
  NotFoundError,
} from './errors.js';

// ---------------------------------------------------------------------------
// Sleep / retry helpers (exported for locator use)
// ---------------------------------------------------------------------------

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryUntil<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  intervalMs = 50,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      return await fn();
    } catch (err) {
      // Strict mode violations are not retryable
      if (err instanceof StrictModeViolationError) throw err;
      lastError = err;
      const remaining = deadline - Date.now();
      if (remaining > 0) await sleep(Math.min(intervalMs, remaining));
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new TimeoutError('operation', timeoutMs);
}

// ---------------------------------------------------------------------------
// Locator handler record
// ---------------------------------------------------------------------------

export type LocatorHandler = {
  locator: PlaywrightLikeLocator;
  handler: () => Promise<void> | void;
};

// ---------------------------------------------------------------------------
// Runtime — wires all subsystems together
// ---------------------------------------------------------------------------

export class Runtime {
  readonly testIdAttribute: string;
  readonly defaultTimeoutMs: number;
  readonly stableFrames: number;
  readonly quietDomMs: number;
  readonly enableShadowDomTraversal: boolean;
  readonly logger: AgentLogger;
  readonly activationBroker: UserActivationBroker;
  readonly registry: AgentRegistryInterface;
  readonly frameChannels: FrameChannelRegistry;

  readonly queryEngine: QueryEngine;
  readonly actionability: ActionabilityEngine;
  readonly stability: StabilityManager;
  readonly executor: ActionExecutor;

  private readonly _locatorHandlers: LocatorHandler[] = [];

  constructor(options: CreateInAppPageOptions = {}) {
    this.testIdAttribute = options.testIdAttribute ?? 'data-testid';
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 5000;
    this.stableFrames = options.stableFrames ?? 2;
    this.quietDomMs = options.quietDomMs ?? 75;
    this.enableShadowDomTraversal = options.enableShadowDomTraversal ?? true;
    this.logger = options.logger ?? {};
    this.activationBroker = options.activationBroker ?? new DefaultActivationBroker();
    this.registry = options.registry ?? new AgentRegistry();
    this.frameChannels = options.frameChannels ?? new DefaultFrameChannelRegistry();

    this.queryEngine = new QueryEngine(
      this.enableShadowDomTraversal,
      this.testIdAttribute,
    );
    this.actionability = new ActionabilityEngine();
    this.stability = new StabilityManager();
    this.executor = new ActionExecutor(this.registry);
  }

  /** Retries fn until it succeeds or the timeout elapses. */
  async retry<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    return retryUntil(fn, timeoutMs ?? this.defaultTimeoutMs);
  }

  /**
   * Resolves exactly one node matching root+steps.
   * Retries on 0 matches. Throws immediately on >1 match.
   */
  async resolveStrict(
    root: QueryRoot,
    steps: QueryStep[],
    description: string,
    timeoutMs?: number,
  ): Promise<ResolvedNode> {
    const timeout = timeoutMs ?? this.defaultTimeoutMs;
    const deadline = Date.now() + timeout;

    let lastError: Error = new NotFoundError(description);

    while (Date.now() < deadline) {
      let nodes: ResolvedNode[];
      try {
        nodes = await this.queryEngine.resolveAll(root, steps);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        await sleep(50);
        continue;
      }

      if (nodes.length === 0) {
        lastError = new NotFoundError(description);
        await sleep(50);
        continue;
      }

      if (nodes.length > 1) {
        // Strict: fail immediately
        throw new StrictModeViolationError(description, nodes.length);
      }

      this.logger.debug?.('locator:resolved', { description, count: 1 });
      return nodes[0];
    }

    this.logger.warn?.('locator:timeout', { description, timeout });
    throw lastError instanceof TimeoutError
      ? lastError
      : new TimeoutError(description, timeout);
  }

  /**
   * Resolves all nodes matching root+steps (non-strict).
   */
  async resolveAll(root: QueryRoot, steps: QueryStep[]): Promise<ResolvedNode[]> {
    return this.queryEngine.resolveAll(root, steps);
  }

  /** Runs any registered locator handlers if their locator is currently visible. */
  async runLocatorHandlers(): Promise<void> {
    for (const { locator, handler } of this._locatorHandlers) {
      try {
        const visible = await locator.isVisible();
        if (visible) {
          this.logger.debug?.('locatorHandler:triggered', {
            description: locator.describe(),
          });
          await handler();
        }
      } catch {
        // Ignore handler errors
      }
    }
  }

  addLocatorHandler(
    locator: PlaywrightLikeLocator,
    handler: () => Promise<void> | void,
  ): void {
    this._locatorHandlers.push({ locator, handler });
  }
}
