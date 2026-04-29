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
  it('keeps ambient auth available when a listed model omits nested capabilities', async () => {
    const client = {
      start: vi.fn().mockResolvedValue(undefined),
      getAuthStatus: vi.fn().mockResolvedValue({
        isAuthenticated: true,
        authType: 'user',
        host: 'https://github.com',
        login: 'octocat',
        statusMessage: 'Signed in as octocat',
      }),
      listModels: vi.fn().mockResolvedValue([
        {
          id: 'gpt-4.1',
          name: 'GPT-4.1',
          capabilities: {},
          supportedReasoningEfforts: ['low', 'medium', 'high'],
          billing: { multiplier: 1 },
        },
      ]),
    };
    const bridge = new CopilotBridge(() => client as never);

    const status = await bridge.getStatus();

    expect(status).toEqual(expect.objectContaining({
      available: true,
      authenticated: true,
      authType: 'user',
      login: 'octocat',
      statusMessage: 'Signed in as octocat',
    }));
    expect(status.models).toEqual([expect.objectContaining({
      id: 'gpt-4.1',
      name: 'GPT-4.1',
      reasoning: true,
      vision: false,
      billingMultiplier: 1,
    })]);
  });

  it('normalizes compatible model shapes and skips only invalid or disabled models', async () => {
    const client = {
      start: vi.fn().mockResolvedValue(undefined),
      getAuthStatus: vi.fn().mockResolvedValue({ isAuthenticated: true }),
      listModels: vi.fn().mockResolvedValue([
        {
          id: 'full-model',
          name: 'Full Model',
          capabilities: {
            supports: { reasoningEffort: true, vision: true },
            limits: { max_context_window_tokens: 128000, max_output_tokens: 4096 },
          },
          policy: { state: 'enabled', terms: '' },
        },
        {
          id: 'missing-capabilities',
          name: 'Missing Capabilities',
        },
        {
          id: 'missing-supports',
          name: 'Missing Supports',
          capabilities: {
            limits: { max_context_window_tokens: 64000, vision: { supported_media_types: ['image/png'], max_prompt_images: 1, max_prompt_image_size: 1024 } },
          },
        },
        {
          id: 'reasoning-list',
          name: 'Reasoning List',
          capabilities: {},
          supportedReasoningEfforts: ['medium'],
        },
        {
          id: 'disabled-model',
          name: 'Disabled Model',
          capabilities: {},
          policy: { state: 'disabled', terms: '' },
        },
        { id: '', name: 'Missing Id', capabilities: {} },
        { id: 'missing-name', capabilities: {} },
      ]),
    };
    const bridge = new CopilotBridge(() => client as never);

    const status = await bridge.getStatus();

    expect(status.available).toBe(true);
    expect(status.authenticated).toBe(true);
    expect(status.models.map((model) => model.id)).toEqual([
      'full-model',
      'missing-capabilities',
      'missing-supports',
      'reasoning-list',
    ]);
    expect(status.models).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'full-model',
        reasoning: true,
        vision: true,
        policyState: 'enabled',
        contextWindow: 128000,
        maxOutputTokens: 4096,
      }),
      expect.objectContaining({
        id: 'missing-capabilities',
        reasoning: false,
        vision: false,
      }),
      expect.objectContaining({
        id: 'missing-supports',
        reasoning: false,
        vision: true,
        contextWindow: 64000,
      }),
      expect.objectContaining({
        id: 'reasoning-list',
        reasoning: true,
        vision: false,
      }),
    ]));
  });

  it('keeps authenticated status when model listing fails', async () => {
    const client = {
      start: vi.fn().mockResolvedValue(undefined),
      getAuthStatus: vi.fn().mockResolvedValue({
        isAuthenticated: true,
        login: 'octocat',
      }),
      listModels: vi.fn().mockRejectedValue(new Error('models.list failed')),
    };
    const bridge = new CopilotBridge(() => client as never);

    const status = await bridge.getStatus();

    expect(status).toEqual(expect.objectContaining({
      available: true,
      authenticated: true,
      login: 'octocat',
      error: 'Failed to list GitHub Copilot models: models.list failed',
      models: [],
    }));
  });

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
