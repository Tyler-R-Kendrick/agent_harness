import { setMaxListeners } from 'node:events';
import {
  ReadableStream,
  TransformStream,
  WritableStream,
} from 'node:stream/web';
import { expect } from 'vitest';

declare module 'vitest' {
  interface Assertion<T = any> {
    toBeInTheDocument(): T;
  }
}

expect.extend({
  toBeInTheDocument(received: unknown) {
    const pass = received instanceof HTMLElement && received.isConnected;
    return {
      pass,
      message: () => pass
        ? 'expected element not to be attached to the document'
        : 'expected element to be attached to the document',
    };
  },
});

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', { value: () => undefined, writable: true });

globalThis.ReadableStream ??= ReadableStream;
globalThis.TransformStream ??= TransformStream;
globalThis.WritableStream ??= WritableStream;

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
