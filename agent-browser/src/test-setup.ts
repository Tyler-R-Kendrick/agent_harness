import '@testing-library/jest-dom/vitest';

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', { value: () => undefined, writable: true });

global.ResizeObserver = class ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
};
