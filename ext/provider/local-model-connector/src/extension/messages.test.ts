import { describe, expect, it, vi } from 'vitest';

import { createExternalMessageHandler, registerStreamPort, type ChromeSender } from './messages';
import { SETTINGS_KEY } from './storage';

const sender: ChromeSender = {
  origin: 'https://app.example.com',
  url: 'https://app.example.com/settings',
};

describe('external message handling', () => {
  it('rejects unapproved sender origins before handling requests', async () => {
    const handler = createExternalMessageHandler({
      allowedSenderPatterns: ['https://app.example.com/*'],
      permissions: fakePermissions(),
      storage: fakeStorage(),
      fetchImpl: vi.fn(),
    });

    await expect(handler({ type: 'ping' }, { origin: 'https://evil.example.com' })).resolves.toEqual({
      ok: false,
      error: 'Sender origin is not allowed.',
      code: 'SENDER_ORIGIN_NOT_ALLOWED',
    });
  });

  it('returns ping metadata and rejects unknown or malformed messages', async () => {
    const handler = createExternalMessageHandler({
      allowedSenderPatterns: ['https://app.example.com/*'],
      permissions: fakePermissions(),
      storage: fakeStorage(),
      fetchImpl: vi.fn(),
      manifest: { name: 'Local Model Connector', version: '0.1.0' },
    });

    await expect(handler({ type: 'ping' }, sender)).resolves.toEqual({
      ok: true,
      data: { name: 'Local Model Connector', version: '0.1.0' },
    });
    const defaultManifestHandler = createExternalMessageHandler({
      allowedSenderPatterns: ['https://app.example.com/*'],
      permissions: fakePermissions(),
      storage: fakeStorage(),
      fetchImpl: vi.fn(),
    });
    await expect(defaultManifestHandler({ type: 'ping' }, sender)).resolves.toEqual({
      ok: true,
      data: { name: 'Local Model Connector', version: '0.1.0' },
    });
    await expect(handler({ type: 'unknown' }, sender)).resolves.toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    await expect(handler(null, sender)).resolves.toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    await expect(handler({ type: 'listModels' }, sender)).resolves.toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    await expect(handler({ type: 'ping' }, { url: 'not a url' })).resolves.toMatchObject({ ok: false, code: 'SENDER_ORIGIN_NOT_ALLOWED' });
    await expect(handler({ type: 'ping' }, undefined)).resolves.toMatchObject({ ok: false, code: 'SENDER_ORIGIN_NOT_ALLOWED' });
  });

  it('requests local host permissions through normalized host permission patterns', async () => {
    const request = vi.fn(async () => true);
    const handler = createExternalMessageHandler({
      allowedSenderPatterns: ['https://app.example.com/*'],
      permissions: fakePermissions({ request }),
      storage: fakeStorage(),
      fetchImpl: vi.fn(),
    });

    await expect(handler({ type: 'requestHostPermission', origin: 'http://127.0.0.1:11434' }, sender)).resolves.toEqual({
      ok: true,
      data: { granted: true },
    });
    expect(request).toHaveBeenCalledWith({ origins: ['http://127.0.0.1/*'] });
  });

  it('requires host permission before proxying model and chat requests', async () => {
    const handler = createExternalMessageHandler({
      allowedSenderPatterns: ['https://app.example.com/*'],
      permissions: fakePermissions({ contains: vi.fn(async () => false) }),
      storage: fakeStorage(),
      fetchImpl: vi.fn(),
    });

    await expect(handler({ type: 'listModels', baseUrl: 'http://127.0.0.1:11434/v1' }, sender)).resolves.toMatchObject({
      ok: false,
      code: 'HOST_PERMISSION_REQUIRED',
    });
  });

  it('proxies model and chat requests after host permission is present', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/models')) return new Response(JSON.stringify({ data: [{ id: 'llama' }] }));
      return new Response(JSON.stringify({ choices: [{ message: { content: 'hi' } }] }));
    });
    const handler = createExternalMessageHandler({
      allowedSenderPatterns: ['https://app.example.com/*'],
      permissions: fakePermissions(),
      storage: fakeStorage(),
      fetchImpl,
    });

    await expect(handler({ type: 'listModels', baseUrl: 'http://127.0.0.1:11434/v1' }, { url: 'https://app.example.com/settings' })).resolves.toEqual({
      ok: true,
      data: { data: [{ id: 'llama' }] },
    });
    await expect(handler({ type: 'listModels', baseUrl: 'http://127.0.0.1:11434/v1', apiKey: '' }, sender)).resolves.toEqual({
      ok: true,
      data: { data: [{ id: 'llama' }] },
    });
    await expect(handler({ type: 'listModels', baseUrl: 'http://127.0.0.1:11434/v1', apiKey: 'secret' }, sender)).resolves.toEqual({
      ok: true,
      data: { data: [{ id: 'llama' }] },
    });
    await expect(handler({
      type: 'chatCompletion',
      baseUrl: 'http://127.0.0.1:11434/v1',
      apiKey: 123,
      body: { model: 'llama', messages: [{ role: 'user', content: 'hello' }] },
    }, sender)).resolves.toMatchObject({ ok: true });
  });

  it('saves non-sensitive settings and hides stored API keys when reading them back', async () => {
    const storage = fakeStorage();
    const handler = createExternalMessageHandler({
      allowedSenderPatterns: ['https://app.example.com/*'],
      permissions: fakePermissions(),
      storage,
      fetchImpl: vi.fn(),
    });

    await expect(handler({
      type: 'saveSettings',
      settings: {
        providerId: 'lm-studio',
        baseUrl: 'http://127.0.0.1:1234/v1',
        selectedModel: 'llama',
        persistApiKey: false,
        apiKey: 'do-not-store',
      },
    }, sender)).resolves.toEqual({ ok: true, data: { saved: true } });
    await expect(handler({ type: 'getSettings' }, sender)).resolves.toEqual({
      ok: true,
      data: {
        providerId: 'lm-studio',
        baseUrl: 'http://127.0.0.1:1234/v1',
        selectedModel: 'llama',
        hasStoredApiKey: false,
      },
    });

    await expect(handler({
      type: 'saveSettings',
      settings: {
        selectedModel: '',
        providerId: 'lm-studio',
        baseUrl: 'http://127.0.0.1:1234/v1',
        persistApiKey: true,
        apiKey: 'store-me',
      },
    }, sender)).resolves.toEqual({ ok: true, data: { saved: true } });
    await expect(handler({ type: 'getSettings' }, sender)).resolves.toMatchObject({
      ok: true,
      data: { hasStoredApiKey: true },
    });
    await expect(handler({ type: 'clearSettings' }, sender)).resolves.toEqual({ ok: true, data: { cleared: true } });
    await expect(handler({ type: 'getSettings' }, sender)).resolves.toEqual({
      ok: true,
      data: { hasStoredApiKey: false },
    });
    await expect(handler({ type: 'saveSettings', settings: { persistApiKey: false } }, sender)).resolves.toEqual({ ok: true, data: { saved: true } });
  });

  it('ignores corrupted stored settings fields when reading settings', async () => {
    const storage = fakeStorage();
    await storage.set({
      [SETTINGS_KEY]: {
        providerId: 123,
        baseUrl: 'http://127.0.0.1:1234/v1',
        selectedModel: '',
        apiKey: true,
      },
    });
    const handler = createExternalMessageHandler({
      allowedSenderPatterns: ['https://app.example.com/*'],
      permissions: fakePermissions(),
      storage,
      fetchImpl: vi.fn(),
    });

    await expect(handler({ type: 'getSettings' }, sender)).resolves.toEqual({
      ok: true,
      data: {
        baseUrl: 'http://127.0.0.1:1234/v1',
        hasStoredApiKey: false,
      },
    });
  });

  it('handles streaming runtime ports with sender, payload, permission, and success paths', async () => {
    const ignoredPort = fakePort({ name: 'other-port', sender });
    registerStreamPort(ignoredPort, {
      allowedSenderPatterns: ['https://app.example.com/*'],
      permissions: fakePermissions(),
      storage: fakeStorage(),
      fetchImpl: vi.fn(),
    });
    expect(ignoredPort.messageListener).toBeUndefined();

    const deniedPort = fakePort({ sender: { origin: 'https://evil.example.com' } });
    registerStreamPort(deniedPort, {
      allowedSenderPatterns: ['https://app.example.com/*'],
      permissions: fakePermissions(),
      storage: fakeStorage(),
      fetchImpl: vi.fn(),
    });
    deniedPort.messageListener?.({ type: 'streamChatCompletion', requestId: 'bad' });
    expect(deniedPort.messages[0]).toMatchObject({
      type: 'error',
      requestId: 'bad',
      error: 'Sender origin is not allowed.',
      code: 'SENDER_ORIGIN_NOT_ALLOWED',
    });

    const malformedPort = fakePort({ sender });
    registerStreamPort(malformedPort, {
      allowedSenderPatterns: ['https://app.example.com/*'],
      permissions: fakePermissions(),
      storage: fakeStorage(),
      fetchImpl: vi.fn(),
    });
    malformedPort.messageListener?.({ type: 'streamChatCompletion' });
    expect(malformedPort.messages[0]).toMatchObject({ type: 'error', code: 'INVALID_REQUEST' });

    const permissionPort = fakePort({ sender });
    registerStreamPort(permissionPort, {
      allowedSenderPatterns: ['https://app.example.com/*'],
      permissions: fakePermissions({ contains: vi.fn(async () => false) }),
      storage: fakeStorage(),
      fetchImpl: vi.fn(),
    });
    permissionPort.messageListener?.({
      type: 'streamChatCompletion',
      requestId: 'req-permission',
      baseUrl: 'http://127.0.0.1:11434/v1',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(permissionPort.messages[0]).toMatchObject({ type: 'error', requestId: 'req-permission', code: 'HOST_PERMISSION_REQUIRED' });

    const successPort = fakePort({ sender });
    registerStreamPort(successPort, {
      allowedSenderPatterns: ['https://app.example.com/*'],
      permissions: fakePermissions(),
      storage: fakeStorage(),
      fetchImpl: async () => new Response(textStream('data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n')),
    });
    successPort.messageListener?.({
      type: 'streamChatCompletion',
      requestId: 'req-ok',
      baseUrl: 'http://127.0.0.1:11434/v1',
      body: { model: 'llama', messages: [{ role: 'user', content: 'hello' }], stream: true },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(successPort.messages).toEqual([
      { type: 'start', requestId: 'req-ok' },
      { type: 'token', requestId: 'req-ok', token: 'hi', raw: { choices: [{ delta: { content: 'hi' } }] } },
      { type: 'done', requestId: 'req-ok' },
    ]);
    successPort.disconnectListener?.();
  });
});

function textStream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function fakePort({ name = 'local-model-stream', sender: portSender = sender }: { name?: string; sender?: ChromeSender } = {}) {
  const state: {
    name: string;
    sender?: ChromeSender;
    messages: unknown[];
    messageListener?: (message: unknown) => void;
    disconnectListener?: () => void;
    postMessage: (message: unknown) => void;
    onMessage: { addListener: (listener: (message: unknown) => void) => void };
    onDisconnect: { addListener: (listener: () => void) => void };
  } = {
    name,
    sender: portSender,
    messages: [],
    postMessage(message: unknown) {
      state.messages.push(message);
    },
    onMessage: {
      addListener(listener: (message: unknown) => void) {
        state.messageListener = listener;
      },
    },
    onDisconnect: {
      addListener(listener: () => void) {
        state.disconnectListener = listener;
      },
    },
  };
  return state;
}

function fakePermissions(overrides: Partial<{
  contains: (permissions: { origins: string[] }) => Promise<boolean>;
  request: (permissions: { origins: string[] }) => Promise<boolean>;
}> = {}) {
  return {
    contains: overrides.contains ?? vi.fn(async () => true),
    request: overrides.request ?? vi.fn(async () => true),
  };
}

function fakeStorage() {
  let state: Record<string, unknown> = {};
  return {
    get: vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => {
      if (!keys) return { ...state };
      if (typeof keys === 'string') return { [keys]: state[keys] };
      if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, state[key]]));
      return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, state[key] ?? fallback]));
    }),
    set: vi.fn(async (values: Record<string, unknown>) => {
      state = { ...state, ...values };
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete state[key];
      }
    }),
  };
}
