import { describe, expect, it, vi } from 'vitest';

const generateMock = vi.fn();
const toAiSdkMessagesMock = vi.fn((messages: Array<{ id: string; role: string; content: string; streamedContent?: string }>) => messages.map((message): { id: string; role: string; parts: Array<Record<string, unknown>> } => ({
  id: message.id,
  role: message.role,
  parts: [{ type: 'text', text: message.streamedContent || message.content }],
})));

vi.mock('../../services/browserInference', () => ({
  browserInferenceEngine: {
    generate: (...args: unknown[]) => generateMock(...args),
  },
}));

vi.mock('../../services/chatComposition', () => ({
  toAiSdkMessages: (messages: Array<{ id: string; role: string; content: string; streamedContent?: string }>) => toAiSdkMessagesMock(messages),
}));

import { buildCodiPrompt, hasCodiModels, resolveCodiModelId, streamCodiChat } from '.';
import { wrapVoterWithCallbacks } from '../agent-loop';
import { PayloadType } from 'logact';
import type { IntentPayload } from 'logact';

describe('Codi', () => {
  it('detects whether any Codi models are installed', () => {
    expect(hasCodiModels([])).toBe(false);
    expect(hasCodiModels([{ id: 'model-a', name: 'Model A', author: 'A', task: 'text-generation', downloads: 1, likes: 1, tags: [], sizeMB: 1, status: 'installed' }])).toBe(true);
  });

  it('builds a workspace-aware prompt without Copilot-specific metadata', () => {
    const prompt = buildCodiPrompt({
      workspaceName: 'Research',
      workspacePromptContext: 'AGENTS.md says: Always validate before shipping.',
      messages: [
        { id: 'system-1', role: 'system', content: 'ready' },
        { id: 'user-1', role: 'user', content: 'Summarize the workspace.' },
      ],
    });

    const content = prompt.map((message) => message.content).join('\n\n');
    expect(content).toContain('Active workspace: Research');
    expect(content).toContain('Always validate before shipping.');
    expect(content).not.toContain('Copilot bridge');
    expect(content).not.toContain('GitHub Copilot');
  });

  it('ignores non-text AI message parts when building the prompt body', () => {
    toAiSdkMessagesMock.mockReturnValueOnce([
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'tool-call' }],
      },
    ]);

    const prompt = buildCodiPrompt({
      workspaceName: 'Research',
      workspacePromptContext: 'Use workspace files.',
      messages: [{ id: 'assistant-1', role: 'assistant', content: 'ignored' }],
    });

    expect(prompt.at(-1)).toEqual({ role: 'assistant', content: '' });
  });

  it('trims oversized workspace context before sending it to the local model', () => {
    const prompt = buildCodiPrompt({
      workspaceName: 'Research',
      workspacePromptContext: `Workspace capability files loaded from browser storage:\n${'x'.repeat(8_000)}`,
      messages: [{ id: 'user-1', role: 'user', content: 'Summarize the workspace.' }],
    });

    expect(prompt[2]?.content.length).toBeLessThanOrEqual(4_000);
    expect(prompt[2]?.content).toContain('...');
  });

  it('resolves the selected model to the first installed model when the stored selection is stale', () => {
    expect(resolveCodiModelId([
      { id: 'model-a', name: 'Model A', author: 'A', task: 'text-generation', downloads: 1, likes: 1, tags: [], sizeMB: 1, status: 'installed' },
      { id: 'model-b', name: 'Model B', author: 'B', task: 'text-generation', downloads: 1, likes: 1, tags: [], sizeMB: 1, status: 'installed' },
    ], 'missing-model')).toBe('model-a');
  });

  it('preserves the selected model when it is still installed and falls back to empty when none are available', () => {
    expect(resolveCodiModelId([
      { id: 'model-a', name: 'Model A', author: 'A', task: 'text-generation', downloads: 1, likes: 1, tags: [], sizeMB: 1, status: 'installed' },
    ], 'model-a')).toBe('model-a');
    expect(resolveCodiModelId([], 'missing-model')).toBe('');
  });

  it('streams reasoning and final text through the Codi adapter', async () => {
    generateMock.mockImplementationOnce(async (_input, callbacks) => {
      callbacks.onPhase?.('thinking');
      callbacks.onToken?.('<think>plan');
      callbacks.onToken?.(' more');
      callbacks.onToken?.('</think>answer');
      callbacks.onToken?.(' done');
      callbacks.onDone?.({ generated_text: 'ignored because tokens win' });
    });

    const onPhase = vi.fn();
    const onReasoning = vi.fn();
    const onToken = vi.fn();
    const onDone = vi.fn();

    await streamCodiChat({
      model: { id: 'model-a', name: 'Model A', author: 'A', task: 'text-generation', downloads: 1, likes: 1, tags: [], sizeMB: 1, status: 'installed' },
      messages: [{ id: 'user-1', role: 'user', content: 'hello' }],
      workspaceName: 'Research',
      workspacePromptContext: 'Use workspace files.',
    }, { onPhase, onReasoning, onToken, onDone });

    expect(onPhase).toHaveBeenCalledWith('thinking');
    expect(onReasoning).toHaveBeenCalledTimes(2);
    expect(onReasoning).toHaveBeenNthCalledWith(1, 'plan');
    expect(onReasoning).toHaveBeenNthCalledWith(2, ' more');
    expect(onToken).toHaveBeenCalledTimes(2);
    expect(onToken).toHaveBeenNthCalledWith(1, 'answer');
    expect(onToken).toHaveBeenNthCalledWith(2, ' done');
    expect(onDone).toHaveBeenCalledWith('answer done');
  });

  it('falls back to formatted output and forwards engine errors', async () => {
    generateMock.mockImplementationOnce(async (_input, callbacks) => {
      callbacks.onDone?.({ generated_text: 'formatted result' });
    });

    const onDone = vi.fn();
    await streamCodiChat({
      model: { id: 'model-a', name: 'Model A', author: 'A', task: 'text-generation', downloads: 1, likes: 1, tags: [], sizeMB: 1, status: 'installed' },
      messages: [{ id: 'user-1', role: 'user', content: 'hello' }],
      workspaceName: 'Research',
      workspacePromptContext: 'Use workspace files.',
    }, { onDone });

    expect(onDone).toHaveBeenCalledWith('formatted result');

    generateMock.mockImplementationOnce(async (_input, callbacks) => {
      callbacks.onError?.(new Error('engine failed'));
    });

    const onError = vi.fn();
    await streamCodiChat({
      model: { id: 'model-a', name: 'Model A', author: 'A', task: 'text-generation', downloads: 1, likes: 1, tags: [], sizeMB: 1, status: 'installed' },
      messages: [{ id: 'user-1', role: 'user', content: 'hello' }],
      workspaceName: 'Research',
      workspacePromptContext: 'Use workspace files.',
    }, { onError });

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'engine failed' }));
  });

  it('handles a completed reasoning block with no trailing answer token', async () => {
    generateMock.mockImplementationOnce(async (_input, callbacks) => {
      callbacks.onToken?.('<think>plan');
      callbacks.onToken?.('</think>');
      callbacks.onDone?.({ generated_text: 'fallback after thinking' });
    });

    const onToken = vi.fn();
    const onDone = vi.fn();
    await streamCodiChat({
      model: { id: 'model-a', name: 'Model A', author: 'A', task: 'text-generation', downloads: 1, likes: 1, tags: [], sizeMB: 1, status: 'installed' },
      messages: [{ id: 'user-1', role: 'user', content: 'hello' }],
      workspaceName: 'Research',
      workspacePromptContext: 'Use workspace files.',
    }, { onToken, onDone });

    expect(onToken).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith('fallback after thinking');
  });

  it('supports reasoning blocks that end with an answer even when no token callback is provided', async () => {
    generateMock.mockImplementationOnce(async (_input, callbacks) => {
      callbacks.onToken?.('<think>plan');
      callbacks.onToken?.('</think>answer');
      callbacks.onDone?.({ generated_text: 'ignored' });
    });

    const onDone = vi.fn();
    await streamCodiChat({
      model: { id: 'model-a', name: 'Model A', author: 'A', task: 'text-generation', downloads: 1, likes: 1, tags: [], sizeMB: 1, status: 'installed' },
      messages: [{ id: 'user-1', role: 'user', content: 'hello' }],
      workspaceName: 'Research',
      workspacePromptContext: 'Use workspace files.',
    }, { onDone });

    expect(onDone).toHaveBeenCalledWith('answer');
  });

  it('handles an empty messages array without throwing', async () => {
    generateMock.mockImplementationOnce(async (_input, callbacks) => {
      callbacks.onDone?.({ generated_text: 'response' });
    });

    const onDone = vi.fn();
    await streamCodiChat({
      model: { id: 'model-a', name: 'Model A', author: 'A', task: 'text-generation', downloads: 1, likes: 1, tags: [], sizeMB: 1, status: 'installed' },
      messages: [],
      workspaceName: 'Research',
      workspacePromptContext: 'Use workspace files.',
    }, { onDone });

    expect(onDone).toHaveBeenCalledWith('response');
  });

  it('retries execution-oriented prompts when the first answer is only a plan and only surfaces the final answer once', async () => {
    const startingCalls = generateMock.mock.calls.length;
    generateMock
      .mockImplementationOnce(async (_input, callbacks) => {
        callbacks.onToken?.('Plan:\n1. Inspect the file\n2. Update the code');
        callbacks.onDone?.({ generated_text: 'Plan:\n1. Inspect the file\n2. Update the code' });
      })
      .mockImplementationOnce(async (_input, callbacks) => {
        callbacks.onToken?.('Implemented the fix and verified the tests pass.');
        callbacks.onDone?.({ generated_text: 'Implemented the fix and verified the tests pass.' });
      });

    const onDone = vi.fn();

    await streamCodiChat({
      model: { id: 'model-a', name: 'Model A', author: 'A', task: 'text-generation', downloads: 1, likes: 1, tags: [], sizeMB: 1, status: 'installed' },
      messages: [{ id: 'user-1', role: 'user', content: 'Implement the fix and run the tests.' }],
      workspaceName: 'Build',
      workspacePromptContext: 'Use workspace files.',
    }, { onDone });

    expect(generateMock.mock.calls.length - startingCalls).toBe(2);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('Implemented the fix and verified the tests pass.');
    const secondPrompt = generateMock.mock.calls[startingCalls + 1][0].prompt as Array<{ role: string; content: string }>;
    expect(secondPrompt.some((message) => String(message.content).includes('Do the work to completion'))).toBe(true);
  });
});

describe('wrapVoterWithCallbacks', () => {
  it('fires onVoterStep when voting starts and onVoterStepUpdate/End when done (approve)', async () => {
    const innerVoter = {
      id: 'safety',
      tier: 'classic' as const,
      vote: vi.fn().mockResolvedValue({
        type: 'Vote',
        intentId: 'i1',
        voterId: 'safety',
        approve: true,
      }),
    };

    const onVoterStep = vi.fn();
    const onVoterStepUpdate = vi.fn();
    const onVoterStepEnd = vi.fn();

    const wrapped = wrapVoterWithCallbacks(innerVoter, { onVoterStep, onVoterStepUpdate, onVoterStepEnd });
    const fakeIntent: IntentPayload = { type: PayloadType.Intent, intentId: 'i1', action: 'do something' };
    const fakeBus = {} as never;

    const result = await wrapped.vote(fakeIntent, fakeBus);

    expect(result.approve).toBe(true);
    expect(onVoterStep).toHaveBeenCalledOnce();
    expect(onVoterStep.mock.calls[0][0]).toMatchObject({ voterId: 'safety', status: 'active', kind: 'agent' });

    expect(onVoterStepUpdate).toHaveBeenCalledOnce();
    expect(onVoterStepUpdate.mock.calls[0][1]).toMatchObject({ approve: true, body: 'Approved', status: 'done' });

    expect(onVoterStepEnd).toHaveBeenCalledOnce();
    expect(onVoterStepEnd.mock.calls[0][0]).toBe(onVoterStep.mock.calls[0][0].id);
  });

  it('fires onVoterStepUpdate with Rejected body when the voter rejects', async () => {
    const innerVoter = {
      id: 'policy',
      tier: 'classic' as const,
      vote: vi.fn().mockResolvedValue({
        type: 'Vote',
        intentId: 'i1',
        voterId: 'policy',
        approve: false,
        reason: 'not on allowlist',
      }),
    };

    const onVoterStepUpdate = vi.fn();
    const wrapped = wrapVoterWithCallbacks(innerVoter, { onVoterStepUpdate });
    await wrapped.vote({ type: PayloadType.Intent, intentId: 'i1', action: 'rm -rf /' }, {} as never);

    expect(onVoterStepUpdate.mock.calls[0][1]).toMatchObject({
      approve: false,
      body: 'Rejected: not on allowlist',
    });
  });

  it('fires onVoterStepUpdate with error body and rethrows when the voter throws', async () => {
    const innerVoter = {
      id: 'flaky',
      tier: 'classic' as const,
      vote: vi.fn().mockRejectedValue(new Error('network timeout')),
    };

    const onVoterStepUpdate = vi.fn();
    const onVoterStepEnd = vi.fn();
    const wrapped = wrapVoterWithCallbacks(innerVoter, { onVoterStepUpdate, onVoterStepEnd });

    await expect(wrapped.vote({ type: PayloadType.Intent, intentId: 'i1', action: 'ping' }, {} as never)).rejects.toThrow('network timeout');
    expect(onVoterStepUpdate.mock.calls[0][1]).toMatchObject({ approve: false, body: 'Error: network timeout' });
    expect(onVoterStepEnd).toHaveBeenCalledOnce();
  });

  it('wires voters into streamCodiChat and fires voter callbacks', async () => {
    generateMock.mockImplementationOnce(async (_input, callbacks) => {
      callbacks.onToken?.('result');
      callbacks.onDone?.({ generated_text: 'result' });
    });

    const innerVoter = {
      id: 'guard',
      tier: 'classic' as const,
      vote: vi.fn().mockResolvedValue({
        type: 'Vote',
        intentId: expect.any(String),
        voterId: 'guard',
        approve: true,
      }),
    };

    const onVoterStep = vi.fn();
    const onVoterStepEnd = vi.fn();

    await streamCodiChat({
      model: { id: 'model-a', name: 'Model A', author: 'A', task: 'text-generation', downloads: 1, likes: 1, tags: [], sizeMB: 1, status: 'installed' },
      messages: [{ id: 'u1', role: 'user', content: 'run tests' }],
      workspaceName: 'Build',
      workspacePromptContext: '',
      voters: [innerVoter],
    }, { onVoterStep, onVoterStepEnd });

    expect(onVoterStep).toHaveBeenCalledOnce();
    expect(onVoterStep.mock.calls[0][0]).toMatchObject({ voterId: 'guard', status: 'active' });
    expect(onVoterStepEnd).toHaveBeenCalledOnce();
    expect(innerVoter.vote).toHaveBeenCalledOnce();
  });

  it('surfaces a voter thought through streamCodiChat', async () => {
    generateMock.mockImplementationOnce(async (_input, callbacks) => {
      callbacks.onToken?.('result');
      callbacks.onDone?.({ generated_text: 'result' });
    });

    const thinkingVoter = {
      id: 'reviewer',
      tier: 'classic' as const,
      vote: vi.fn().mockResolvedValue({
        type: 'Vote',
        intentId: expect.any(String),
        voterId: 'reviewer',
        approve: true,
        thought: 'Low-risk read; no side effects.',
      }),
    };

    const onVoterStepUpdate = vi.fn();

    await streamCodiChat({
      model: { id: 'model-a', name: 'Model A', author: 'A', task: 'text-generation', downloads: 1, likes: 1, tags: [], sizeMB: 1, status: 'installed' },
      messages: [{ id: 'u1', role: 'user', content: 'read workspace file' }],
      workspaceName: 'Build',
      workspacePromptContext: '',
      voters: [thinkingVoter],
    }, { onVoterStepUpdate });

    expect(onVoterStepUpdate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        approve: true,
        body: 'Approved',
        thought: 'Low-risk read; no side effects.',
      }),
    );
  });
});