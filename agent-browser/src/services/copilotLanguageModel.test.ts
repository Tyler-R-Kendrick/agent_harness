import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopilotLanguageModel } from './copilotLanguageModel';

function createNdjsonResponse(events: unknown[]): Response {
  return new Response(
    `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
    {
      status: 200,
      headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
    },
  );
}

describe('CopilotLanguageModel', () => {
  const originalFetch = global.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('includes the chat session id in Copilot proxy requests', async () => {
    fetchMock.mockResolvedValue(createNdjsonResponse([
      { type: 'final', content: 'done' },
      { type: 'done' },
    ]));

    const model = new CopilotLanguageModel('gpt-4.1', 'chat-session-1');
    await model.doGenerate({
      abortSignal: undefined,
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Use tools.' }] }],
      tools: [],
    } as never);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/copilot/chat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          modelId: 'gpt-4.1',
          prompt: '[user]\nUse tools.',
          sessionId: 'chat-session-1',
        }),
      }),
    );
  });
});