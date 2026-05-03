import { describe, expect, it, vi } from 'vitest';

const streamCodexRuntimeChatMock = vi.fn();

vi.mock('../../services/codexApi', async () => {
  const actual = await vi.importActual<typeof import('../../services/codexApi')>('../../services/codexApi');
  return {
    ...actual,
    streamCodexRuntimeChat: (...args: unknown[]) => streamCodexRuntimeChatMock(...args),
  };
});

import { buildCodexPrompt, hasCodexAccess, resolveCodexModelId, streamCodexChat } from '.';

describe('Codex', () => {
  it('detects Codex availability and resolves model ids', () => {
    expect(hasCodexAccess({
      available: false,
      authenticated: true,
      models: [{ id: 'codex-default', name: 'Codex default', reasoning: true, vision: false }],
      signInCommand: 'codex login',
      signInDocsUrl: 'https://developers.openai.com/codex/auth',
    })).toBe(false);

    expect(hasCodexAccess({
      available: true,
      authenticated: true,
      models: [{ id: 'codex-default', name: 'Codex default', reasoning: true, vision: false }],
      signInCommand: 'codex login',
      signInDocsUrl: 'https://developers.openai.com/codex/auth',
    })).toBe(true);

    expect(resolveCodexModelId([{ id: 'codex-default', name: 'Codex default', reasoning: true, vision: false }], 'codex-default')).toBe('codex-default');
    expect(resolveCodexModelId([{ id: 'codex-default', name: 'Codex default', reasoning: true, vision: false }], 'missing')).toBe('codex-default');
    expect(resolveCodexModelId([], 'missing')).toBe('');
  });

  it('builds a workspace prompt with transcript and latest input', () => {
    const prompt = buildCodexPrompt({
      workspaceName: 'Build',
      workspacePromptContext: 'Workspace prompt context.',
      messages: [
        { id: 'assistant-1', role: 'assistant', content: 'done' },
        { id: 'user-1', role: 'user', content: 'Fix this.' },
      ],
      latestUserInput: 'Fix this.',
    });

    expect(prompt).toContain('## Persona');
    expect(prompt).toContain('## Workspace Context');
    expect(prompt).toContain('assistant: done');
    expect(prompt).toContain('Latest user request:\nFix this.');
    expect(prompt).toContain('Help the user in the active workspace with concise, grounded collaboration.');
  });

  it('forwards Codex requests to the runtime API', async () => {
    streamCodexRuntimeChatMock.mockResolvedValueOnce(undefined);
    const callbacks = { onToken: vi.fn() };
    const signal = new AbortController().signal;

    await streamCodexChat({
      modelId: 'codex-default',
      sessionId: 'chat-session-1',
      workspaceName: 'Build',
      workspacePromptContext: 'Workspace prompt context.',
      messages: [{ id: 'user-1', role: 'user', content: 'Fix this.' }],
      latestUserInput: 'Fix this.',
    }, callbacks, signal);

    expect(streamCodexRuntimeChatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'codex-default',
        sessionId: 'chat-session-1',
        prompt: expect.stringContaining('## Workspace Context'),
      }),
      expect.objectContaining({ onToken: expect.any(Function) }),
      signal,
    );
  });

  it('retries execution prompts when the first Codex answer is only a plan', async () => {
    const startingCalls = streamCodexRuntimeChatMock.mock.calls.length;
    streamCodexRuntimeChatMock
      .mockImplementationOnce(async (_request, callbacks) => {
        callbacks.onToken?.('Plan:\n1. Inspect\n2. Update');
        callbacks.onDone?.('Plan:\n1. Inspect\n2. Update');
      })
      .mockImplementationOnce(async (_request, callbacks) => {
        callbacks.onToken?.('Implemented the fix and verified the tests pass.');
        callbacks.onDone?.('Implemented the fix and verified the tests pass.');
      });

    const onDone = vi.fn();

    await streamCodexChat({
      modelId: 'codex-default',
      sessionId: 'chat-session-1',
      workspaceName: 'Build',
      workspacePromptContext: 'Workspace prompt context.',
      messages: [{ id: 'user-1', role: 'user', content: 'Implement the fix and run the tests.' }],
      latestUserInput: 'Implement the fix and run the tests.',
    }, { onDone });

    expect(streamCodexRuntimeChatMock.mock.calls.length - startingCalls).toBe(2);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('Implemented the fix and verified the tests pass.');
    expect(String(streamCodexRuntimeChatMock.mock.calls[startingCalls + 1][0].prompt)).toContain('Do the work to completion');
  });
});
