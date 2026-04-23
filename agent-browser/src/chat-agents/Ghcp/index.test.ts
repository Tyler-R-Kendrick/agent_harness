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

    expect(prompt).toContain('## Persona');
    expect(prompt).toContain('## Workspace Context');
    expect(prompt).toContain('assistant: done');
    expect(prompt).toContain('Latest user request:\nSummarize this.');
  });

  it('uses shared scenario guidance for coding-style GHCP prompts', () => {
    const prompt = buildGhcpPrompt({
      workspaceName: 'Build',
      workspacePromptContext: 'Workspace prompt context.',
      messages: [{ id: 'user-1', role: 'user', content: 'Fix the failing vitest run.' }],
      latestUserInput: 'Fix the failing vitest run.',
    });

    expect(prompt).toContain('## Coding Guidance');
    expect(prompt).toContain('## Goal');
    expect(prompt).toContain('Help the user in the active workspace with concise, grounded collaboration.');
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
      sessionId: 'chat-session-1',
      workspaceName: 'Research',
      workspacePromptContext: 'Workspace prompt context.',
      messages: [{ id: 'user-1', role: 'user', content: 'Summarize this.' }],
      latestUserInput: 'Summarize this.',
    }, callbacks, signal);

    expect(streamCopilotChatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'gpt-4.1',
        sessionId: 'chat-session-1',
        prompt: expect.stringContaining('## Workspace Context'),
      }),
      expect.objectContaining({ onToken: expect.any(Function) }),
      signal,
    );
  });

  it('streams GHCP output through the shared loop and returns cleaned final content', async () => {
    streamCopilotChatMock.mockImplementationOnce(async (_request, callbacks) => {
      callbacks.onToken?.('Hello\n');
      callbacks.onToken?.('world');
      callbacks.onDone?.('###STEP: Plan\nHello\nworld');
    });

    const onToken = vi.fn();
    const onDone = vi.fn();

    await streamGhcpChat({
      modelId: 'gpt-4.1',
      sessionId: 'chat-session-1',
      workspaceName: 'Research',
      workspacePromptContext: 'Workspace prompt context.',
      messages: [{ id: 'user-1', role: 'user', content: 'Summarize this.' }],
      latestUserInput: 'Summarize this.',
    }, { onToken, onDone });

    expect(onToken).toHaveBeenCalledWith('Hello\n');
    expect(onToken).toHaveBeenCalledWith('world');
    expect(onDone).toHaveBeenCalledWith('Hello\nworld');
  });

  it('surfaces a voter thought through streamGhcpChat', async () => {
    streamCopilotChatMock.mockImplementationOnce(async (_request, callbacks) => {
      callbacks.onToken?.('ok');
      callbacks.onDone?.('ok');
    });

    const thinkingVoter = {
      id: 'reviewer',
      tier: 'classic' as const,
      vote: vi.fn().mockResolvedValue({
        type: 'Vote',
        intentId: expect.any(String),
        voterId: 'reviewer',
        approve: false,
        reason: 'needs owner approval',
        thought: 'This prompt edits shared infra; flagging for review.',
      }),
    };

    const onVoterStepUpdate = vi.fn();

    await streamGhcpChat({
      modelId: 'gpt-4.1',
      sessionId: 'chat-session-1',
      workspaceName: 'Research',
      workspacePromptContext: 'Workspace prompt context.',
      messages: [{ id: 'user-1', role: 'user', content: 'Deploy infra.' }],
      latestUserInput: 'Deploy infra.',
      voters: [thinkingVoter],
    }, { onVoterStepUpdate });

    expect(onVoterStepUpdate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        approve: false,
        body: 'Rejected: needs owner approval',
        thought: 'This prompt edits shared infra; flagging for review.',
      }),
    );
  });

  it('retries execution-oriented prompts when the first GHCP answer is only a plan and only surfaces the final answer once', async () => {
    const startingCalls = streamCopilotChatMock.mock.calls.length;
    streamCopilotChatMock
      .mockImplementationOnce(async (_request, callbacks) => {
        callbacks.onToken?.('Plan:\n1. Inspect\n2. Update');
        callbacks.onDone?.('Plan:\n1. Inspect\n2. Update');
      })
      .mockImplementationOnce(async (_request, callbacks) => {
        callbacks.onToken?.('Implemented the fix and verified the tests pass.');
        callbacks.onDone?.('Implemented the fix and verified the tests pass.');
      });

    const onDone = vi.fn();

    await streamGhcpChat({
      modelId: 'gpt-4.1',
      sessionId: 'chat-session-1',
      workspaceName: 'Build',
      workspacePromptContext: 'Workspace prompt context.',
      messages: [{ id: 'user-1', role: 'user', content: 'Implement the fix and run the tests.' }],
      latestUserInput: 'Implement the fix and run the tests.',
    }, { onDone });

    expect(streamCopilotChatMock.mock.calls.length - startingCalls).toBe(2);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('Implemented the fix and verified the tests pass.');
    expect(String(streamCopilotChatMock.mock.calls[startingCalls + 1][0].prompt)).toContain('Do the work to completion');
  });
});