import { describe, expect, it, vi } from 'vitest';

import { parseOpenAIStreamChunk, streamChatCompletion } from './streaming';

describe('streaming chat completions', () => {
  it('parses SSE chunks, emits tokens, and stops on DONE', () => {
    expect(parseOpenAIStreamChunk('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n')).toEqual([
      { done: false, token: 'hi', raw: { choices: [{ delta: { content: 'hi' } }] } },
    ]);
    expect(parseOpenAIStreamChunk('event: message\ndata: [DONE]\n\n')).toEqual([{ done: true }]);
  });

  it('ignores recoverable malformed SSE events and reports unrecoverable stream failures', async () => {
    const events: unknown[] = [];
    const stream = textStream('data: not-json\n\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n');
    const fetchImpl = vi.fn(async () => new Response(stream, {
      headers: { 'content-type': 'text/event-stream' },
    }));

    await streamChatCompletion({
      requestId: 'req-1',
      baseUrl: 'http://127.0.0.1:11434/v1',
      body: {
        model: 'llama',
        messages: [{ role: 'user', content: 'hello' }],
        sae: { adapter: 'sparse-autoencoder', scope: 'mistral-editing' },
        stream: true,
      },
      fetchImpl,
      emit: (event) => events.push(event),
    });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      sae: { adapter: 'sparse-autoencoder', scope: 'mistral-editing' },
      stream: true,
    });
    expect(events).toEqual([
      { type: 'start', requestId: 'req-1' },
      { type: 'token', requestId: 'req-1', token: 'ok', raw: { choices: [{ delta: { content: 'ok' } }] } },
      { type: 'done', requestId: 'req-1' },
    ]);
  });

  it('aborts when the disconnect signal fires', async () => {
    const controller = new AbortController();
    const events: unknown[] = [];
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      controller.abort();
      init?.signal?.dispatchEvent(new Event('abort'));
      throw new DOMException('aborted', 'AbortError');
    });

    await streamChatCompletion({
      requestId: 'req-2',
      baseUrl: 'http://localhost:1234/v1',
      body: { model: 'llama', messages: [{ role: 'user', content: 'hello' }], stream: true },
      fetchImpl,
      emit: (event) => events.push(event),
      disconnectSignal: controller.signal,
    });

    expect(events).toEqual([
      { type: 'start', requestId: 'req-2' },
      { type: 'error', requestId: 'req-2', error: 'Stream was aborted.', code: 'STREAM_ABORTED' },
    ]);
  });

  it('emits structured stream errors for HTTP failures and empty stream bodies', async () => {
    const httpEvents: unknown[] = [];
    await streamChatCompletion({
      requestId: 'req-http',
      baseUrl: 'http://127.0.0.1:11434/v1',
      body: { model: 'llama', messages: [{ role: 'user', content: 'hello' }], stream: true },
      fetchImpl: async () => new Response('nope', { status: 500 }),
      emit: (event) => httpEvents.push(event),
    });
    expect(httpEvents).toEqual([
      { type: 'start', requestId: 'req-http' },
      { type: 'error', requestId: 'req-http', error: 'Local endpoint returned an HTTP error.', code: 'ENDPOINT_HTTP_ERROR', status: 500 },
    ]);

    const emptyEvents: unknown[] = [];
    await streamChatCompletion({
      requestId: 'req-empty',
      baseUrl: 'http://127.0.0.1:11434/v1',
      body: { model: 'llama', messages: [{ role: 'user', content: 'hello' }], stream: true },
      fetchImpl: async () => ({ ok: true, body: null, status: 200 }) as Response,
      emit: (event) => emptyEvents.push(event),
    });
    expect(emptyEvents).toEqual([
      { type: 'start', requestId: 'req-empty' },
      { type: 'error', requestId: 'req-empty', error: 'Streaming response body is empty.', code: 'STREAM_PARSE_ERROR' },
    ]);

    const unavailableEvents: unknown[] = [];
    await streamChatCompletion({
      requestId: 'req-unavailable',
      baseUrl: 'http://127.0.0.1:11434/v1',
      body: { model: 'llama', messages: [{ role: 'user', content: 'hello' }], stream: true },
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
      emit: (event) => unavailableEvents.push(event),
    });
    expect(unavailableEvents).toEqual([
      { type: 'start', requestId: 'req-unavailable' },
      { type: 'error', requestId: 'req-unavailable', error: 'No local model server responded at this address.', code: 'ENDPOINT_UNAVAILABLE', status: undefined },
    ]);

    const unknownEvents: unknown[] = [];
    await streamChatCompletion({
      requestId: 'req-unknown',
      baseUrl: 'http://127.0.0.1:11434/v1',
      body: { model: 'llama', messages: [{ role: 'user', content: 'hello' }], stream: true },
      fetchImpl: async () => {
        throw new Error('surprise');
      },
      emit: (event) => unknownEvents.push(event),
    });
    expect(unknownEvents).toEqual([
      { type: 'start', requestId: 'req-unknown' },
      { type: 'error', requestId: 'req-unknown', error: 'Request could not be completed.', code: 'ENDPOINT_UNAVAILABLE', status: undefined },
    ]);
  });

  it('parses text deltas and completes streams without explicit DONE markers', async () => {
    expect(parseOpenAIStreamChunk('data: {"choices":[{"text":"legacy"}]}\n\n')).toEqual([
      { done: false, token: 'legacy', raw: { choices: [{ text: 'legacy' }] } },
    ]);
    expect(parseOpenAIStreamChunk('data: {"choices":[]}\n\nevent: ping\n\ndata:\n\ndata: {}\n\ndata: 1\n\n')).toEqual([]);
    expect(parseOpenAIStreamChunk('data: {"choices":[{"delta":{"content":12}}]}\n\n')).toEqual([]);

    const events: unknown[] = [];
    await streamChatCompletion({
      requestId: 'req-finish',
      baseUrl: 'http://localhost:1234/v1',
      body: { model: 'llama', messages: [{ role: 'user', content: 'hello' }], stream: true },
      fetchImpl: async () => new Response(textStream('data: {"choices":[{"text":"legacy"}]}\n\n')),
      emit: (event) => events.push(event),
    });
    expect(events).toEqual([
      { type: 'start', requestId: 'req-finish' },
      { type: 'token', requestId: 'req-finish', token: 'legacy', raw: { choices: [{ text: 'legacy' }] } },
      { type: 'done', requestId: 'req-finish' },
    ]);

    const bufferedEvents: unknown[] = [];
    await streamChatCompletion({
      requestId: 'req-buffer',
      baseUrl: 'http://localhost:1234/v1',
      body: { model: 'llama', messages: [{ role: 'user', content: 'hello' }], stream: true },
      fetchImpl: async () => new Response(textStream('data: {"choices":[{"text":"tail"}]}')),
      emit: (event) => bufferedEvents.push(event),
    });
    expect(bufferedEvents).toEqual([
      { type: 'start', requestId: 'req-buffer' },
      { type: 'token', requestId: 'req-buffer', token: 'tail', raw: { choices: [{ text: 'tail' }] } },
      { type: 'done', requestId: 'req-buffer' },
    ]);

    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(textStream('data: [DONE]\n\n'))));
    try {
      const defaultFetchEvents: unknown[] = [];
      await streamChatCompletion({
        requestId: 'req-default-fetch',
        baseUrl: 'http://localhost:1234/v1',
        body: { model: 'llama', messages: [{ role: 'user', content: 'hello' }], stream: true },
        emit: (event) => defaultFetchEvents.push(event),
      });
      expect(defaultFetchEvents).toEqual([
        { type: 'start', requestId: 'req-default-fetch' },
        { type: 'done', requestId: 'req-default-fetch' },
      ]);
    } finally {
      vi.stubGlobal('fetch', originalFetch);
    }
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
