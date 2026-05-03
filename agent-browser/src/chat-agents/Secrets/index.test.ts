import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IndexedDbSecretStore,
  MemorySecretStore,
  createDefaultSecretStore,
  createSecretsManagerAgent,
  getDefaultSecretsManagerAgent,
  resetDefaultSecretsManagerAgentForTests,
  secretRefForId,
  wrapToolsForSecretResolution,
} from '.';

describe('agent-browser secrets wrapper', () => {
  afterEach(() => {
    resetDefaultSecretsManagerAgentForTests();
    vi.doUnmock('idb-keyval');
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('uses memory storage when IndexedDB is unavailable', () => {
    vi.stubGlobal('indexedDB', undefined);

    const store = createDefaultSecretStore();

    expect(store).toBeInstanceOf(MemorySecretStore);
    expect(secretRefForId('!!!')).toBe('secret-ref://local/secret');
  });

  it('uses IndexedDB storage when browser storage is available', async () => {
    vi.resetModules();
    const records = new Map<string, unknown>();
    const createStore = vi.fn((databaseName: string, storeName: string) => ({ databaseName, storeName }));
    const get = vi.fn(async (id: string) => records.get(id));
    const set = vi.fn(async (id: string, record: unknown) => {
      records.set(id, record);
    });
    const del = vi.fn(async (id: string) => {
      records.delete(id);
    });
    const keys = vi.fn(async () => ['indexed-secret', 42]);

    vi.doMock('idb-keyval', () => ({
      createStore,
      del,
      get,
      keys,
      set,
    }));
    vi.stubGlobal('indexedDB', {});

    const module = await import('.');
    const store = module.createDefaultSecretStore();
    const record = {
      id: 'indexed-secret',
      value: 'stored-in-indexeddb',
      label: 'manual',
      source: 'manual' as const,
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    };

    expect(store).toBeInstanceOf(module.IndexedDbSecretStore);
    expect(createStore).toHaveBeenCalledWith('agent-browser-secrets', 'secrets');
    await store.set(record);
    await expect(store.get('indexed-secret')).resolves.toEqual(record);
    await expect(store.list?.()).resolves.toEqual([record]);
    await store.delete?.('indexed-secret');
    await expect(store.get('indexed-secret')).resolves.toBeUndefined();
    expect(set).toHaveBeenCalledWith('indexed-secret', record, { databaseName: 'agent-browser-secrets', storeName: 'secrets' });
    expect(del).toHaveBeenCalledWith('indexed-secret', { databaseName: 'agent-browser-secrets', storeName: 'secrets' });
  });

  it('creates browser-default managers while still allowing test storage injection', async () => {
    const store = new MemorySecretStore();
    const agent = createSecretsManagerAgent({ store, now: () => '2026-04-30T00:00:00.000Z' });

    await expect(agent.storeSecret({
      name: 'OPENWEATHER_API_KEY',
      value: 'weather-key-value-1234567890',
    })).resolves.toBe('secret-ref://local/openweather-api-key');

    await expect(store.list()).resolves.toEqual([expect.objectContaining({
      id: 'openweather-api-key',
      value: 'weather-key-value-1234567890',
    })]);
    expect(getDefaultSecretsManagerAgent()).toBe(getDefaultSecretsManagerAgent());
  });

  it('wraps AI SDK tool sets without exposing resolved secret values in tool results', async () => {
    const store = new MemorySecretStore();
    await store.set({
      id: 'api-token',
      value: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890',
      label: 'manual',
      source: 'manual',
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    });
    const agent = createSecretsManagerAgent({ store });
    const execute = vi.fn(async (args: unknown) => ({
      observedAuthorization: (args as { headers: { Authorization: string } }).headers.Authorization,
      echoedSecret: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890',
    }));
    const passthrough = { description: 'no execute' };

    const tools = wrapToolsForSecretResolution({
      request: { execute },
      passthrough,
    } as never, agent) as {
      request: { execute: (args: unknown) => Promise<unknown> };
      passthrough: typeof passthrough;
    };

    const result = await tools.request.execute({
      headers: {
        Authorization: 'Bearer secret-ref://local/api-token',
      },
    });

    expect(execute).toHaveBeenCalledWith({
      headers: {
        Authorization: 'Bearer sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890',
      },
    }, undefined);
    expect(result).toEqual({
      observedAuthorization: 'Bearer secret-ref://local/api-token',
      echoedSecret: 'secret-ref://local/api-token',
    });
    expect(tools.passthrough).toBe(passthrough);
  });

  it('can construct an IndexedDB store with an explicit namespace', () => {
    expect(new IndexedDbSecretStore('custom-secrets')).toBeInstanceOf(IndexedDbSecretStore);
  });
});
