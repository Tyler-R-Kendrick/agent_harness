import { describe, expect, it, vi } from 'vitest';
import { CopilotBridge } from './copilotMiddleware';

type SessionEventHandler = (event: { data: Record<string, unknown> }) => void;

function createMockSession(label: string) {
  const handlers = new Map<string, Set<SessionEventHandler>>();

  const on = vi.fn((eventName: string, handler: SessionEventHandler) => {
    const bucket = handlers.get(eventName) ?? new Set<SessionEventHandler>();
    bucket.add(handler);
    handlers.set(eventName, bucket);
    return () => {
      bucket.delete(handler);
    };
  });

  const emit = (eventName: string, data: Record<string, unknown>) => {
    handlers.get(eventName)?.forEach((handler) => handler({ data }));
  };

  return {
    sessionId: label,
    on,
    send: vi.fn(async ({ prompt }: { prompt: string }) => {
      emit('assistant.message', { content: `reply:${prompt}` });
      emit('session.idle', { aborted: false });
      return `${label}-message`;
    }),
    abort: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    setModel: vi.fn().mockResolvedValue(undefined),
  };
}

describe('CopilotBridge', () => {
  it('reuses one Copilot session for repeated requests in the same chat session', async () => {
    const session = createMockSession('copilot-session-1');
    const client = {
      start: vi.fn().mockResolvedValue(undefined),
      createSession: vi.fn().mockResolvedValue(session),
    };
    const bridge = new CopilotBridge(() => client as never);

    const events: Array<{ type: string }> = [];
    await bridge.streamChat({ modelId: 'gpt-4.1', prompt: 'First prompt', sessionId: 'chat-session-1' }, new AbortController().signal, (event) => {
      events.push({ type: event.type });
    });
    await bridge.streamChat({ modelId: 'gpt-4.1', prompt: 'Second prompt', sessionId: 'chat-session-1' }, new AbortController().signal, () => undefined);

    expect(client.createSession).toHaveBeenCalledTimes(1);
    expect(client.createSession).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'chat-session-1',
      model: 'gpt-4.1',
    }));
    expect(session.send).toHaveBeenNthCalledWith(1, { prompt: 'First prompt' });
    expect(session.send).toHaveBeenNthCalledWith(2, { prompt: 'Second prompt' });
    expect(session.disconnect).not.toHaveBeenCalled();
    expect(events).toEqual(expect.arrayContaining([{ type: 'final' }, { type: 'done' }]));
  });

  it('updates the model on the existing Copilot session instead of creating a new one', async () => {
    const session = createMockSession('copilot-session-1');
    const client = {
      start: vi.fn().mockResolvedValue(undefined),
      createSession: vi.fn().mockResolvedValue(session),
    };
    const bridge = new CopilotBridge(() => client as never);

    await bridge.streamChat({ modelId: 'gpt-4.1', prompt: 'First prompt', sessionId: 'chat-session-1' }, new AbortController().signal, () => undefined);
    await bridge.streamChat({ modelId: 'claude-sonnet-4.6', prompt: 'Second prompt', sessionId: 'chat-session-1' }, new AbortController().signal, () => undefined);

    expect(client.createSession).toHaveBeenCalledTimes(1);
    expect(session.setModel).toHaveBeenCalledWith('claude-sonnet-4.6');
    expect(session.send).toHaveBeenNthCalledWith(2, { prompt: 'Second prompt' });
  });
});