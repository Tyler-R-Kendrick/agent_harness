import { describe, expect, it, vi } from 'vitest';
import { CursorBridge } from './cursorMiddleware';

function createCursorAgent(events: unknown[]) {
  return {
    send: vi.fn(async () => ({
      stream: async function* stream() {
        for (const event of events) {
          yield event;
        }
      },
      wait: vi.fn().mockResolvedValue({ text: 'waited result' }),
      cancel: vi.fn().mockResolvedValue(undefined),
    })),
  };
}

describe('CursorBridge', () => {
  it('reports setup guidance when CURSOR_API_KEY is missing', async () => {
    const bridge = new CursorBridge({
      env: {},
      createAgent: vi.fn(),
    });

    await expect(bridge.getStatus()).resolves.toEqual(expect.objectContaining({
      available: true,
      authenticated: false,
      models: [],
      signInCommand: 'Set CURSOR_API_KEY in the dev server environment',
    }));
  });

  it('reports public beta models when a Cursor API key is configured', async () => {
    const bridge = new CursorBridge({
      env: { CURSOR_API_KEY: 'cursor-key' },
      createAgent: vi.fn(),
    });

    const status = await bridge.getStatus();

    expect(status).toEqual(expect.objectContaining({
      available: true,
      authenticated: true,
      authType: 'api-key',
      statusMessage: 'CURSOR_API_KEY configured',
    }));
    expect(status.models.map((model) => model.id)).toEqual([
      'composer-2',
      'gpt-5.5',
      'codex-5.3-high-fast',
    ]);
  });

  it('creates one Cursor SDK agent per chat session and streams normalized events', async () => {
    const agent = createCursorAgent([
      { type: 'message_delta', text: 'Hello ' },
      { type: 'reasoning_delta', text: 'thinking' },
      { type: 'message', text: 'Hello world' },
    ]);
    const createAgent = vi.fn().mockResolvedValue(agent);
    const bridge = new CursorBridge({
      env: { CURSOR_API_KEY: 'cursor-key' },
      createAgent,
    });

    const events: Array<{ type: string; delta?: string; content?: string }> = [];
    await bridge.streamChat({
      modelId: 'composer-2',
      prompt: 'Say hello',
      sessionId: 'chat-session-1',
    }, new AbortController().signal, (event) => {
      events.push(event);
    });

    expect(createAgent).toHaveBeenCalledTimes(1);
    expect(createAgent).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'cursor-key',
      model: { id: 'composer-2' },
      local: { cwd: expect.any(String) },
    }));
    expect(agent.send).toHaveBeenCalledWith('Say hello');
    expect(events).toEqual([
      { type: 'token', delta: 'Hello ' },
      { type: 'reasoning', delta: 'thinking' },
      { type: 'final', content: 'Hello world' },
      { type: 'done' },
    ]);
  });

  it('rejects chat requests for unknown Cursor models', async () => {
    const bridge = new CursorBridge({
      env: { CURSOR_API_KEY: 'cursor-key' },
      createAgent: vi.fn(),
    });

    await expect(bridge.validateChatRequest({
      modelId: 'unknown',
      prompt: 'Say hello',
      sessionId: 'chat-session-1',
    })).rejects.toThrow('Cursor model "unknown" is not enabled for this environment.');
  });
});
