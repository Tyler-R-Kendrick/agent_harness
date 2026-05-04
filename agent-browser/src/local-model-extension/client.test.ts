import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LOCAL_PROVIDER_PRESETS,
  listLocalModelsViaExtension,
  probeLocalModelExtension,
  requestLocalEndpointPermission,
  runLocalChatCompletionViaExtension,
  streamLocalChatCompletionViaExtension,
} from './client';

describe('PWA local model extension client', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('returns an installed:false state when chrome external messaging is unavailable', async () => {
    await expect(probeLocalModelExtension()).resolves.toEqual({ installed: false });
  });

  it('pings the extension and unwraps successful model responses', async () => {
    installChromeRuntime({
      sendMessage: vi.fn((_extensionId, message, callback) => {
        if (message.type === 'ping') callback({ ok: true, data: { version: '0.1.0', name: 'Local Model Connector' } });
        if (message.type === 'listModels') callback({ ok: true, data: { data: [{ id: 'llama' }] } });
      }),
    });

    await expect(probeLocalModelExtension({ extensionId: 'extension-id' })).resolves.toEqual({ installed: true, version: '0.1.0' });
    await expect(listLocalModelsViaExtension({ extensionId: 'extension-id', baseUrl: 'http://127.0.0.1:11434/v1' })).resolves.toEqual([{ id: 'llama' }]);
  });

  it('maps chrome.runtime.lastError to actionable extension errors', async () => {
    installChromeRuntime({
      lastError: { message: 'Could not establish connection. Receiving end does not exist.' },
      sendMessage: vi.fn((_extensionId, _message, callback) => callback(undefined)),
    });

    await expect(probeLocalModelExtension({ extensionId: 'missing' })).resolves.toEqual({ installed: false });
    await expect(requestLocalEndpointPermission({ extensionId: 'missing', origin: 'http://127.0.0.1:11434' })).rejects.toMatchObject({
      code: 'EXTENSION_NOT_INSTALLED',
    });
  });

  it('sends non-streaming chat completions through the extension', async () => {
    const sendMessage = vi.fn((_extensionId, message, callback) => {
      expect(message).toMatchObject({
        type: 'chatCompletion',
        baseUrl: 'http://localhost:1234/v1',
        body: { model: 'llama', stream: false },
      });
      callback({ ok: true, data: { choices: [{ message: { content: 'hi' } }] } });
    });
    installChromeRuntime({ sendMessage });

    await expect(runLocalChatCompletionViaExtension({
      extensionId: 'extension-id',
      baseUrl: 'http://localhost:1234/v1',
      model: 'llama',
      messages: [{ role: 'user', content: 'hello' }],
    })).resolves.toEqual({ choices: [{ message: { content: 'hi' } }] });
  });

  it('streams tokens over a long-lived runtime port and supports cancellation', () => {
    const disconnect = vi.fn();
    const postMessage = vi.fn();
    let messageListener: ((message: unknown) => void) | undefined;
    installChromeRuntime({
      connect: vi.fn(() => ({
        name: 'local-model-stream',
        postMessage,
        disconnect,
        onMessage: { addListener: (listener: (message: unknown) => void) => { messageListener = listener; } },
        onDisconnect: { addListener: vi.fn() },
      })),
    });
    const tokens: string[] = [];
    const done = vi.fn();

    const stream = streamLocalChatCompletionViaExtension({
      extensionId: 'extension-id',
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: 'llama',
      messages: [{ role: 'user', content: 'hello' }],
      onToken: (token) => tokens.push(token),
      onDone: done,
    });

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'streamChatCompletion', requestId: expect.any(String) }));
    messageListener?.({ type: 'start', requestId: String(postMessage.mock.calls[0][0].requestId) });
    messageListener?.({ type: 'token', requestId: String(postMessage.mock.calls[0][0].requestId), token: 'hi' });
    messageListener?.({ type: 'done', requestId: String(postMessage.mock.calls[0][0].requestId) });
    stream.cancel();
    expect(tokens).toEqual(['hi']);
    expect(done).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('exports provider presets for common OpenAI-compatible local runtimes', () => {
    expect(LOCAL_PROVIDER_PRESETS.map((preset) => preset.id)).toEqual([
      'lm-studio',
      'ollama-openai',
      'foundry-local',
      'custom',
    ]);
  });
});

function installChromeRuntime(runtime: Record<string, unknown>) {
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      runtime: {
        lastError: undefined,
        ...runtime,
      },
    },
  });
}
