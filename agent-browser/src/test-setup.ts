import '@testing-library/jest-dom/vitest';
import { setMaxListeners } from 'node:events';

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', { value: () => undefined, writable: true });

const NativeAbortController = globalThis.AbortController;

globalThis.AbortController = class AbortControllerWithListenerBudget extends NativeAbortController {
  constructor() {
    super();
    setMaxListeners(256, this.signal);
  }
};

global.ResizeObserver = class ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
};
