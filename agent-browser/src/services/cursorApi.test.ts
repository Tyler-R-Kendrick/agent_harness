import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCursorState, streamCursorChat } from './cursorApi';

function createNdjsonResponse(events: unknown[]): Response {
  return new Response(
    `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
    {
      status: 200,
      headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
    },
  );
}

describe('cursorApi', () => {
  const originalFetch = global.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches Cursor runtime status from the app proxy', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      available: true,
      authenticated: true,
      authType: 'api-key',
      statusMessage: 'CURSOR_API_KEY configured',
      models: [{ id: 'composer-2', name: 'Composer 2' }],
      signInCommand: 'Set CURSOR_API_KEY in the dev server environment',
      signInDocsUrl: 'https://cursor.com/blog/typescript-sdk',
    })));

    await expect(fetchCursorState()).resolves.toEqual(expect.objectContaining({
      available: true,
      authenticated: true,
      models: [expect.objectContaining({ id: 'composer-2' })],
    }));
    expect(fetchMock).toHaveBeenCalledWith('/api/cursor/status', { signal: undefined });
  });

  it('streams Cursor chat events from newline-delimited JSON', async () => {
    fetchMock.mockResolvedValue(createNdjsonResponse([
      { type: 'token', delta: 'Hello ' },
      { type: 'reasoning', delta: 'thinking' },
      { type: 'final', content: 'Hello world' },
      { type: 'done' },
    ]));
    const callbacks = {
      onToken: vi.fn(),
      onReasoning: vi.fn(),
      onDone: vi.fn(),
    };

    await streamCursorChat({
      modelId: 'composer-2',
      prompt: 'Say hello',
      sessionId: 'chat-session-1',
    }, callbacks);

    expect(fetchMock).toHaveBeenCalledWith('/api/cursor/chat', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        modelId: 'composer-2',
        prompt: 'Say hello',
        sessionId: 'chat-session-1',
      }),
    }));
    expect(callbacks.onToken).toHaveBeenCalledWith('Hello ');
    expect(callbacks.onReasoning).toHaveBeenCalledWith('thinking');
    expect(callbacks.onDone).toHaveBeenCalledWith('Hello world');
  });

  it('surfaces Cursor proxy error messages', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      error: 'Cursor is not signed in in this environment.',
    }), { status: 401 }));

    await expect(streamCursorChat({
      modelId: 'composer-2',
      prompt: 'Say hello',
      sessionId: 'chat-session-1',
    }, {})).rejects.toThrow('Cursor is not signed in in this environment.');
  });
});
