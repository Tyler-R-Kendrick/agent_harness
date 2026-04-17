import type { CreateInAppPageOptions, PlaywrightLikePage } from './types.js';
import { Runtime } from './runtime.js';
import { InAppPage } from './page.js';

/**
 * Creates a Playwright-shaped in-app DOM control runtime bound to the
 * current page document.
 *
 * @example
 * ```ts
 * const page = createInAppPage();
 * await page.getByRole('button', { name: 'Submit' }).click();
 * ```
 */
export function createInAppPage(options?: CreateInAppPageOptions): PlaywrightLikePage {
  const runtime = new Runtime(options);
  return new InAppPage(runtime);
}

// Re-export everything for consumers
export type {
  PlaywrightLikePage,
  PlaywrightLikeLocator,
  PlaywrightLikeFrameLocator,
  CreateInAppPageOptions,
} from './types.js';

export { AgentRegistry } from './registry.js';
export { DefaultActivationBroker } from './activation.js';
export {
  DefaultFrameChannelRegistry,
  installFrameRPCHandler,
  getSameOriginFrameDocument,
} from './frameRpc.js';
export { ActionabilityEngine } from './actionability.js';
export { StabilityManager } from './stability.js';
export { QueryEngine } from './queryEngine.js';
export { ActionExecutor } from './actionExecutor.js';
export { Runtime } from './runtime.js';
export { InAppPage } from './page.js';
export { InAppLocator, InAppFrameLocator } from './locator.js';
export * from './errors.js';
