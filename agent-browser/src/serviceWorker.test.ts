import { describe, expect, it, vi } from 'vitest';

import { configureServiceWorker, resetDevelopmentServiceWorker } from './serviceWorker';

function createSessionStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
  };
}

describe('resetDevelopmentServiceWorker', () => {
  it('unregisters dev service workers and clears agent-browser caches', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const sessionStorage = createSessionStorage();
    const cacheDelete = vi.fn().mockResolvedValue(true);
    const reload = vi.fn();

    await resetDevelopmentServiceWorker({
      serviceWorker: {
        controller: undefined,
        getRegistrations: vi.fn().mockResolvedValue([{ unregister }]),
        register: vi.fn(),
      },
      cacheStorage: {
        keys: vi.fn().mockResolvedValue(['agent-browser-v1', 'other-cache']),
        delete: cacheDelete,
      },
      sessionStorage,
      reload,
    });

    expect(unregister).toHaveBeenCalledTimes(1);
    expect(cacheDelete).toHaveBeenCalledTimes(1);
    expect(cacheDelete).toHaveBeenCalledWith('agent-browser-v1');
    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('agent-browser:dev-service-worker-reset');
  });

  it('reloads once when a stale service worker still controls the page', async () => {
    const sessionStorage = createSessionStorage();
    const reload = vi.fn();

    await resetDevelopmentServiceWorker({
      serviceWorker: {
        controller: {},
        getRegistrations: vi.fn().mockResolvedValue([{ unregister: vi.fn().mockResolvedValue(true) }]),
        register: vi.fn(),
      },
      cacheStorage: {
        keys: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(true),
      },
      sessionStorage,
      reload,
    });

    expect(sessionStorage.setItem).toHaveBeenCalledWith('agent-browser:dev-service-worker-reset', 'true');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload again once the dev reset flag is set', async () => {
    const sessionStorage = createSessionStorage({ 'agent-browser:dev-service-worker-reset': 'true' });
    const reload = vi.fn();

    await resetDevelopmentServiceWorker({
      serviceWorker: {
        controller: {},
        getRegistrations: vi.fn().mockResolvedValue([{ unregister: vi.fn().mockResolvedValue(true) }]),
        register: vi.fn(),
      },
      cacheStorage: {
        keys: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(true),
      },
      sessionStorage,
      reload,
    });

    expect(reload).not.toHaveBeenCalled();
  });
});

describe('configureServiceWorker', () => {
  it('registers the worker on load outside development', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    let loadListener: (() => void) | undefined;

    configureServiceWorker({
      isDev: false,
      serviceWorker: {
        controller: undefined,
        getRegistrations: vi.fn().mockResolvedValue([]),
        register,
      },
      addLoadListener(listener) {
        loadListener = listener;
      },
      reload: vi.fn(),
    });

    expect(register).not.toHaveBeenCalled();
    loadListener?.();
    await Promise.resolve();
    expect(register).toHaveBeenCalledWith('/sw.js');
  });
});