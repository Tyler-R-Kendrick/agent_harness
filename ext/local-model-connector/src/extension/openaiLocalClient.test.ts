import { describe, expect, it, vi } from 'vitest';

import { chatCompletion, fetchLocalEndpoint, listModels, mapStatusCode } from './openaiLocalClient';

describe('local OpenAI-compatible client', () => {
  it('forms GET /models requests without cookies and uses Authorization only for explicit API keys', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ object: 'list', data: [{ id: 'llama' }] }), {
      headers: { 'content-type': 'application/json' },
    }));

    await expect(listModels({ baseUrl: 'http://127.0.0.1:11434/v1', apiKey: 'secret', fetchImpl })).resolves.toEqual({
      ok: true,
      data: { object: 'list', data: [{ id: 'llama' }] },
    });

    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:11434/v1/models', expect.objectContaining({
      method: 'GET',
      credentials: 'omit',
      headers: expect.objectContaining({
        Accept: 'application/json',
        Authorization: 'Bearer secret',
      }),
    }));
  });

  it('forms POST /chat/completions requests and forces non-streaming bodies', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: 'chatcmpl', choices: [] }), {
      headers: { 'content-type': 'application/json' },
    }));

    const result = await chatCompletion({
      baseUrl: 'http://localhost:1234/v1/',
      fetchImpl,
      body: {
        model: 'local-model',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
      },
    });

    expect(result).toEqual({ ok: true, data: { id: 'chatcmpl', choices: [] } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:1234/v1/chat/completions');
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(String(init.body))).toMatchObject({ model: 'local-model', stream: false });
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('returns text payloads with content type when chat JSON parsing fails', async () => {
    const fetchImpl = vi.fn(async () => new Response('plain text', {
      headers: { 'content-type': 'text/plain' },
    }));

    await expect(chatCompletion({
      baseUrl: 'http://127.0.0.1:11434/v1',
      fetchImpl,
      body: { model: 'local-model', messages: [{ role: 'user', content: 'hello' }] },
    })).resolves.toEqual({
      ok: true,
      data: { text: 'plain text', contentType: 'text/plain' },
    });
  });

  it('falls back to the global fetch implementation and empty content types', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async () => new Response('not-json'));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(chatCompletion({
        baseUrl: 'http://127.0.0.1:11434/v1',
        body: { model: 'local-model', messages: [{ role: 'user', content: 'hello' }] },
      })).resolves.toEqual({
        ok: true,
        data: { text: 'not-json', contentType: 'text/plain;charset=UTF-8' },
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.stubGlobal('fetch', originalFetch);
    }

    await expect(chatCompletion({
      baseUrl: 'http://127.0.0.1:11434/v1',
      body: { model: 'local-model', messages: [{ role: 'user', content: 'hello' }] },
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: { get: () => null },
        clone: () => ({ json: async () => { throw new Error('not json'); } }),
        text: async () => 'raw',
      }) as unknown as Response,
    })).resolves.toEqual({
      ok: true,
      data: { text: 'raw', contentType: '' },
    });
  });

  it('maps HTTP and network failures to structured errors', async () => {
    await expect(listModels({
      baseUrl: 'http://127.0.0.1:11434/v1',
      fetchImpl: async () => new Response('nope', { status: 401 }),
    })).resolves.toMatchObject({ ok: false, code: 'AUTH_FAILED', status: 401 });

    await expect(listModels({
      baseUrl: 'http://127.0.0.1:11434/v1',
      fetchImpl: async () => new Response('missing', { status: 404 }),
    })).resolves.toMatchObject({ ok: false, code: 'UNSUPPORTED_API', status: 404 });

    await expect(chatCompletion({
      baseUrl: 'http://127.0.0.1:11434/v1',
      body: { model: 'llama', messages: [{ role: 'user', content: 'hello' }] },
      fetchImpl: async () => new Response('missing', { status: 404 }),
    })).resolves.toMatchObject({ ok: false, code: 'ENDPOINT_HTTP_ERROR', status: 404 });

    await expect(listModels({
      baseUrl: 'http://127.0.0.1:11434/v1',
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    })).resolves.toMatchObject({ ok: false, code: 'ENDPOINT_UNAVAILABLE' });

    await expect(listModels({
      baseUrl: 'http://127.0.0.1:11434/v1',
      fetchImpl: async () => {
        throw new Error('unexpected');
      },
    })).resolves.toMatchObject({ ok: false, code: 'ENDPOINT_UNAVAILABLE' });
  });

  it('sanitizes model metadata and rejects unsupported model-list responses', async () => {
    await expect(listModels({
      baseUrl: 'http://127.0.0.1:11434/v1',
      fetchImpl: async () => new Response(JSON.stringify({
        object: 'list',
        data: [{ id: 'llama', object: 'model', created: 1, owned_by: 'local', extra: 'hidden' }],
      })),
    })).resolves.toEqual({
      ok: true,
      data: { object: 'list', data: [{ id: 'llama', object: 'model', created: 1, owned_by: 'local' }] },
    });

    await expect(listModels({
      baseUrl: 'http://127.0.0.1:11434/v1',
      fetchImpl: async () => new Response(JSON.stringify({ data: [{ object: 'model' }] })),
    })).resolves.toMatchObject({ ok: false, code: 'UNSUPPORTED_API' });

    await expect(listModels({
      baseUrl: 'http://127.0.0.1:11434/v1',
      fetchImpl: async () => new Response(JSON.stringify({ nope: [] })),
    })).resolves.toMatchObject({ ok: false, code: 'UNSUPPORTED_API' });
  });

  it('maps timeouts, invalid requests, and status-code helpers', async () => {
    await expect(listModels({
      baseUrl: 'http://127.0.0.1:11434/v1',
      fetchImpl: async () => {
        throw new DOMException('aborted', 'AbortError');
      },
    })).resolves.toMatchObject({ ok: false, code: 'TIMEOUT' });

    await expect(listModels({
      baseUrl: 'https://127.0.0.1:11434/v1',
      fetchImpl: async () => new Response('{}'),
    })).resolves.toMatchObject({ ok: false, code: 'INVALID_BASE_URL' });

    await expect(chatCompletion({
      baseUrl: 'http://127.0.0.1:11434/v1',
      body: { model: '', messages: [] },
      fetchImpl: async () => new Response('{}'),
    })).resolves.toMatchObject({ ok: false, code: 'INVALID_REQUEST' });

    expect(mapStatusCode(408, 'stream')).toMatchObject({ code: 'TIMEOUT', status: 408 });
    expect(mapStatusCode(500, 'stream')).toMatchObject({ code: 'ENDPOINT_HTTP_ERROR', status: 500 });

    await expect(fetchLocalEndpoint({
      baseUrl: 'http://127.0.0.1:11434/v1',
      path: '/v1/embeddings',
      method: 'POST',
      accept: 'application/json',
      body: { model: 'llama' },
      fetchImpl: async (_url, init) => new Response(JSON.stringify({ credentials: init?.credentials })),
    })).resolves.toBeInstanceOf(Response);

    vi.useFakeTimers();
    const timeoutPromise = fetchLocalEndpoint({
      baseUrl: 'http://127.0.0.1:11434/v1',
      path: '/v1/models',
      method: 'GET',
      accept: 'application/json',
      timeoutMs: 1,
      fetchImpl: async (_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
    });
    const timeoutExpectation = expect(timeoutPromise).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(2);
    await timeoutExpectation;
    vi.useRealTimers();
  });
});
