import '@testing-library/jest-dom/vitest';
import { setMaxListeners } from 'node:events';

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', { value: () => undefined, writable: true });

const NativeAbortController = globalThis.AbortController;

function setAbortSignalListenerBudget(signal: AbortSignal) {
  try {
    setMaxListeners(256, signal);
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw error;
    }
  }
}

globalThis.AbortController = class AbortControllerWithListenerBudget extends NativeAbortController {
  constructor() {
    super();
    setAbortSignalListenerBudget(this.signal);
  }
};

global.ResizeObserver = class ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
};
