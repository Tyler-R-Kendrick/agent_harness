import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCodexState, streamCodexRuntimeChat } from './codexApi';

function createNdjsonResponse(lines: unknown[], init: ResponseInit = {}) {
  const body = lines.map((line) => JSON.stringify(line)).join('\n');
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson' },
    ...init,
  });
}

describe('codexApi', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches Codex runtime state', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      available: true,
      authenticated: true,
      version: '0.125.0',
      models: [{ id: 'codex-default', name: 'Codex default', reasoning: true, vision: false }],
      signInCommand: 'codex login',
      signInDocsUrl: 'https://developers.openai.com/codex/auth',
    })));

    await expect(fetchCodexState()).resolves.toMatchObject({
      available: true,
      authenticated: true,
      version: '0.125.0',
      models: [{ id: 'codex-default' }],
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/codex/status', { signal: undefined });
  });

  it('turns non-OK status responses into useful errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      error: 'Codex CLI is unavailable.',
    }), { status: 503 }));

    await expect(fetchCodexState()).rejects.toThrow('Codex CLI is unavailable.');
  });

  it('streams Codex chat events from NDJSON', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(createNdjsonResponse([
      { type: 'reasoning', delta: 'Inspecting workspace' },
      { type: 'token', delta: 'Codex ' },
      { type: 'token', delta: 'response' },
      { type: 'final', content: 'Codex response' },
      { type: 'done' },
    ]));

    const onReasoning = vi.fn();
    const onToken = vi.fn();
    const onDone = vi.fn();
    const signal = new AbortController().signal;

    await streamCodexRuntimeChat({
      modelId: 'codex-default',
      sessionId: 'chat-session-1',
      prompt: 'Prompt',
    }, { onReasoning, onToken, onDone }, signal);

    expect(fetchMock).toHaveBeenCalledWith('/api/codex/chat', expect.objectContaining({
      method: 'POST',
      signal,
      body: JSON.stringify({ modelId: 'codex-default', sessionId: 'chat-session-1', prompt: 'Prompt' }),
    }));
    expect(onReasoning).toHaveBeenCalledWith('Inspecting workspace');
    expect(onToken).toHaveBeenCalledWith('Codex ');
    expect(onToken).toHaveBeenCalledWith('response');
    expect(onDone).toHaveBeenCalledWith('Codex response');
  });

  it('throws streamed Codex errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(createNdjsonResponse([
      { type: 'error', message: 'Codex request failed.' },
    ]));

    await expect(streamCodexRuntimeChat({
      modelId: 'codex-default',
      sessionId: 'chat-session-1',
      prompt: 'Prompt',
    }, {})).rejects.toThrow('Codex request failed.');
  });
});
