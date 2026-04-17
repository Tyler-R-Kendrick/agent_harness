import { describe, expect, it, vi } from 'vitest';

const streamCopilotChatMock = vi.fn();

vi.mock('../../services/copilotApi', async () => {
  const actual = await vi.importActual<typeof import('../../services/copilotApi')>('../../services/copilotApi');
  return {
    ...actual,
    streamCopilotChat: (...args: unknown[]) => streamCopilotChatMock(...args),
  };
});

import { buildGhcpPrompt, hasGhcpAccess, resolveGhcpModelId, streamGhcpChat } from '.';

describe('GHCP', () => {
  it('detects GHCP availability and resolves model ids', () => {
    expect(hasGhcpAccess({
      available: false,
      authenticated: true,
      models: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: true }],
      signInCommand: 'copilot login',
      signInDocsUrl: 'https://docs.github.com/copilot/how-tos/copilot-cli',
    })).toBe(false);

    expect(hasGhcpAccess({
      available: true,
      authenticated: true,
      models: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: true }],
      signInCommand: 'copilot login',
      signInDocsUrl: 'https://docs.github.com/copilot/how-tos/copilot-cli',
    })).toBe(true);

    expect(resolveGhcpModelId([{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: true }], 'gpt-4.1')).toBe('gpt-4.1');
    expect(resolveGhcpModelId([{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: true }], 'missing')).toBe('gpt-4.1');
    expect(resolveGhcpModelId([], 'missing')).toBe('');
  });

  it('builds a prompt with transcript and latest input', () => {
    const prompt = buildGhcpPrompt({
      workspaceName: 'Research',
      workspacePromptContext: 'Workspace prompt context.',
      messages: [
        { id: 'assistant-1', role: 'assistant', content: 'done' },
        { id: 'user-1', role: 'user', content: 'Summarize this.' },
      ],
      latestUserInput: 'Summarize this.',
    });

    expect(prompt).toContain('You are GHCP');
    expect(prompt).toContain('assistant: done');
    expect(prompt).toContain('Latest user request:\nSummarize this.');
  });

  it('omits the transcript block when there is no non-empty prior conversation', () => {
    const prompt = buildGhcpPrompt({
      workspaceName: 'Research',
      workspacePromptContext: 'Workspace prompt context.',
      messages: [{ id: 'user-1', role: 'user', content: '   ' }],
      latestUserInput: 'Summarize this.',
    });

    expect(prompt).not.toContain('Conversation transcript:');
  });

  it('forwards GHCP requests to the Copilot streaming API', async () => {
    streamCopilotChatMock.mockResolvedValueOnce(undefined);
    const callbacks = { onToken: vi.fn() };
    const signal = new AbortController().signal;

    await streamGhcpChat({
      modelId: 'gpt-4.1',
      workspaceName: 'Research',
      workspacePromptContext: 'Workspace prompt context.',
      messages: [{ id: 'user-1', role: 'user', content: 'Summarize this.' }],
      latestUserInput: 'Summarize this.',
    }, callbacks, signal);

    expect(streamCopilotChatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'gpt-4.1',
        prompt: expect.stringContaining('Active workspace: Research'),
      }),
      callbacks,
      signal,
    );
  });
});