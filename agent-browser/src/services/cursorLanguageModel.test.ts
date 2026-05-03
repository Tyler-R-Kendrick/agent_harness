import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CursorLanguageModel } from './cursorLanguageModel';

function createNdjsonResponse(events: unknown[]): Response {
  return new Response(
    `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
    {
      status: 200,
      headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
    },
  );
}

describe('CursorLanguageModel', () => {
  const originalFetch = global.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('includes the chat session id in Cursor proxy requests', async () => {
    fetchMock.mockResolvedValue(createNdjsonResponse([
      { type: 'final', content: 'done' },
      { type: 'done' },
    ]));

    const model = new CursorLanguageModel('composer-2', 'chat-session-1');
    await model.doGenerate({
      abortSignal: undefined,
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Use Cursor.' }] }],
      tools: [],
    } as never);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/cursor/chat',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      modelId: 'composer-2',
      prompt: '[user]\nUse Cursor.',
      sessionId: 'chat-session-1',
    });
  });

  it('injects ReAct tool instructions and returns parsed tool calls', async () => {
    fetchMock.mockResolvedValue(createNdjsonResponse([
      { type: 'final', content: '<tool_call>{"tool":"cli","args":{"command":"pwd"}}</tool_call>' },
      { type: 'done' },
    ]));

    const model = new CursorLanguageModel('composer-2', 'chat-session-1');
    const result = await model.doGenerate({
      abortSignal: undefined,
      prompt: [{ role: 'system', content: 'Use available tools.' }, { role: 'user', content: [{ type: 'text', text: 'Run pwd.' }] }],
      tools: [{
        type: 'function',
        name: 'cli',
        description: 'Run a command',
        inputSchema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
      }],
    } as never);

    expect(fetchMock.mock.calls[0][1].body).toContain('## Tools');
    expect(result.finishReason).toEqual({ unified: 'tool-calls', raw: 'tool-calls' });
    expect(result.content[0]).toMatchObject({
      type: 'tool-call',
      toolName: 'cli',
      input: JSON.stringify({ command: 'pwd' }),
    });
  });
});
