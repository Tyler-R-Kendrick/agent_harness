import { describe, expect, it, vi } from 'vitest';

vi.mock('@huggingface/transformers', () => ({
  TextStreamer: class MockTextStreamer {},
}));

vi.mock('driver.js', () => ({ driver: vi.fn() }));
vi.mock('driver.js/dist/driver.css', () => ({}));

vi.mock('idb-keyval', () => ({
  createStore: vi.fn(() => ({})),
  get: vi.fn(async () => undefined),
  set: vi.fn(async () => undefined),
  del: vi.fn(async () => undefined),
  clear: vi.fn(async () => undefined),
}));

vi.mock('@perplexity-ai/perplexity_ai', () => ({
  Perplexity: class MockPerplexity {},
}));

import * as CodiModule from './Codi';
import * as DebuggerModule from './Debugger';
import * as GhcpModule from './Ghcp';
import * as PlannerModule from './Planner';
import * as SecurityModule from './Security';
import * as TourGuideModule from './TourGuide';
import { streamAgentChat } from './index';
import { MemorySecretStore, createSecretsManagerAgent } from './Secrets';

describe('streamAgentChat', () => {
  it('routes Codi sessions through the Codi adapter', async () => {
    const streamCodiChatSpy = vi.spyOn(CodiModule, 'streamCodiChat').mockResolvedValueOnce();

    await streamAgentChat({
      provider: 'codi',
      model: {
        id: 'model-a',
        name: 'Model A',
        author: 'A',
        task: 'text-generation',
        downloads: 1,
        likes: 1,
        tags: [],
        sizeMB: 1,
        status: 'installed',
      },
      latestUserInput: 'hello from the composer',
      messages: [{ id: 'user-1', role: 'user', content: 'hello' }],
      workspaceName: 'Research',
      workspacePromptContext: 'Use workspace files.',
    }, {});

    expect(streamCodiChatSpy).toHaveBeenCalledWith(expect.objectContaining({
      workspaceName: 'Research',
      latestUserInput: 'hello from the composer',
      messages: [{ id: 'user-1', role: 'user', content: 'hello' }],
    }), {}, undefined);
  });

  it('routes GHCP sessions through the GHCP adapter', async () => {
    const streamGhcpChatSpy = vi.spyOn(GhcpModule, 'streamGhcpChat').mockResolvedValueOnce();

    await streamAgentChat({
      provider: 'ghcp',
      modelId: 'gpt-4.1',
      sessionId: 'session-1',
      latestUserInput: 'hello',
      messages: [{ id: 'user-1', role: 'user', content: 'hello' }],
      workspaceName: 'Research',
      workspacePromptContext: 'Use workspace files.',
    }, {});

    expect(streamGhcpChatSpy).toHaveBeenCalledWith(expect.objectContaining({
      modelId: 'gpt-4.1',
      sessionId: 'session-1',
      latestUserInput: 'hello',
    }), {}, undefined);
  });

  it('strips detected secrets before routing messages to cloud-backed chat agents', async () => {
    const streamGhcpChatSpy = vi.spyOn(GhcpModule, 'streamGhcpChat').mockResolvedValueOnce();
    const secret = 'ghp_abcdefghijklmnopqrstuvwxyz123456';
    const secrets = createSecretsManagerAgent({
      store: new MemorySecretStore(),
      idFactory: () => 'github-token',
      now: () => '2026-04-30T00:00:00.000Z',
    });

    await streamAgentChat({
      provider: 'ghcp',
      modelId: 'gpt-4.1',
      sessionId: 'session-1',
      latestUserInput: `call the API with ${secret}`,
      messages: [{ id: 'user-1', role: 'user', content: `token=${secret}` }],
      workspaceName: 'Research',
      workspacePromptContext: `GITHUB_TOKEN=${secret}`,
      secrets,
    }, {});

    const routedOptions = streamGhcpChatSpy.mock.calls.at(-1)?.[0] as {
      latestUserInput: string;
      messages: Array<{ content: string }>;
      workspacePromptContext: string;
    };
    const routedPayload = JSON.stringify(routedOptions);
    expect(routedPayload).not.toContain(secret);
    expect(routedOptions.latestUserInput).toContain('secret-ref://local/github-token');
    expect(routedOptions.messages[0]?.content).toContain('secret-ref://local/github-token');
    expect(routedOptions.workspacePromptContext).toContain('secret-ref://local/github-token');
  });

  it('routes Debugger sessions through the Debugger adapter', async () => {
    const streamDebuggerChatSpy = vi.spyOn(DebuggerModule, 'streamDebuggerChat').mockResolvedValueOnce();

    await streamAgentChat({
      provider: 'debugger',
      runtimeProvider: 'ghcp',
      modelId: 'gpt-4.1',
      sessionId: 'session-1',
      latestUserInput: 'debug the failing release',
      messages: [{ id: 'user-1', role: 'user', content: 'debug the failing release' }],
      workspaceName: 'Ops',
      workspacePromptContext: 'Use workspace files.',
    }, {});

    expect(streamDebuggerChatSpy).toHaveBeenCalledWith(expect.objectContaining({
      runtimeProvider: 'ghcp',
      modelId: 'gpt-4.1',
      latestUserInput: 'debug the failing release',
    }), {}, undefined);
  });

  it('routes Tour Guide sessions through the TourGuide adapter', async () => {
    const streamTourGuideChatSpy = vi.spyOn(TourGuideModule, 'streamTourGuideChat').mockResolvedValueOnce();

    await streamAgentChat({
      provider: 'tour-guide',
      latestUserInput: 'Show me how to configure tools.',
      messages: [{ id: 'user-1', role: 'user', content: 'Show me how to configure tools.' }],
      workspaceName: 'Ops',
      workspacePromptContext: 'Use workspace files.',
    }, {});

    expect(streamTourGuideChatSpy).toHaveBeenCalledWith(expect.objectContaining({
      latestUserInput: 'Show me how to configure tools.',
      workspaceName: 'Ops',
      workspacePromptContext: 'Use workspace files.',
    }), {}, undefined);
  });

  it('routes Planner sessions through the Planner adapter', async () => {
    const streamPlannerChatSpy = vi.spyOn(PlannerModule, 'streamPlannerChat').mockResolvedValueOnce();

    await streamAgentChat({
      provider: 'planner',
      runtimeProvider: 'ghcp',
      modelId: 'gpt-4.1',
      sessionId: 'session-1',
      latestUserInput: 'Plan and orchestrate this delegated workflow.',
      messages: [{ id: 'user-1', role: 'user', content: 'Plan the work.' }],
      workspaceName: 'Build',
      workspacePromptContext: 'Use workspace files.',
    }, {});

    expect(streamPlannerChatSpy).toHaveBeenCalledWith(expect.objectContaining({
      runtimeProvider: 'ghcp',
      modelId: 'gpt-4.1',
      latestUserInput: 'Plan and orchestrate this delegated workflow.',
      workspaceName: 'Build',
    }), {}, undefined);
  });

  it('routes Security Review sessions through the Security adapter', async () => {
    const streamSecurityReviewChatSpy = vi.spyOn(SecurityModule, 'streamSecurityReviewChat').mockResolvedValueOnce();

    await streamAgentChat({
      provider: 'security',
      runtimeProvider: 'ghcp',
      modelId: 'gpt-4.1',
      sessionId: 'session-1',
      latestUserInput: 'Run a security review for this PR.',
      messages: [{ id: 'user-1', role: 'user', content: 'Review the diff.' }],
      workspaceName: 'Build',
      workspacePromptContext: 'Use workspace files.',
    }, {});

    expect(streamSecurityReviewChatSpy).toHaveBeenCalledWith(expect.objectContaining({
      runtimeProvider: 'ghcp',
      modelId: 'gpt-4.1',
      latestUserInput: 'Run a security review for this PR.',
      workspaceName: 'Build',
    }), {}, undefined);
  });



  it('keeps behavior unchanged when router is disabled', async () => {
    const streamGhcpChatSpy = vi.spyOn(GhcpModule, 'streamGhcpChat').mockResolvedValueOnce();
    await streamAgentChat({
      provider: 'ghcp', modelId: 'gpt-4.1', sessionId: 'session-1', latestUserInput: 'hello',
      messages: [{ id: 'u1', role: 'user', content: 'hello' }], workspaceName: 'Research', workspacePromptContext: '',
      runtimeRouting: { enabled: false },
    }, {});
    expect(streamGhcpChatSpy).toHaveBeenCalledWith(expect.objectContaining({ modelId: 'gpt-4.1' }), {}, undefined);
  });

  it('switches models when router is enabled', async () => {
    const streamDebuggerChatSpy = vi.spyOn(DebuggerModule, 'streamDebuggerChat').mockResolvedValueOnce();
    await streamAgentChat({
      provider: 'debugger', modelId: 'gpt-4.1', sessionId: 'session-1', latestUserInput: 'debug this',
      messages: [{ id: 'u1', role: 'user', content: 'debug this' }], workspaceName: 'Build', workspacePromptContext: '',
      runtimeRouting: { enabled: true, route: async () => ({ runtimeProvider: 'cursor', modelId: 'claude-4-sonnet', confidence: 0.9, tier: 'standard' }) },
    }, {});
    expect(streamDebuggerChatSpy).toHaveBeenCalledWith(expect.objectContaining({ runtimeProvider: 'cursor', modelId: 'claude-4-sonnet' }), {}, undefined);
  });

  it('preserves user model pin over router decision', async () => {
    const streamDebuggerChatSpy = vi.spyOn(DebuggerModule, 'streamDebuggerChat').mockResolvedValueOnce();
    await streamAgentChat({
      provider: 'debugger', modelId: 'gpt-4.1', sessionId: 'session-1', latestUserInput: 'debug this', userPinnedModel: true,
      messages: [{ id: 'u1', role: 'user', content: 'debug this' }], workspaceName: 'Build', workspacePromptContext: '',
      runtimeRouting: { enabled: true, route: async () => ({ runtimeProvider: 'cursor', modelId: 'claude-4-sonnet', confidence: 0.9, tier: 'standard' }) },
    }, {});
    expect(streamDebuggerChatSpy).toHaveBeenCalledWith(expect.objectContaining({ runtimeProvider: 'ghcp', modelId: 'gpt-4.1' }), {}, undefined);
  });

  it('escalates to premium when routing confidence is low', async () => {
    const streamDebuggerChatSpy = vi.spyOn(DebuggerModule, 'streamDebuggerChat').mockResolvedValueOnce();
    const onReasoningStep = vi.fn();
    await streamAgentChat({
      provider: 'debugger', modelId: 'gpt-4.1', sessionId: 'session-1', latestUserInput: 'debug this',
      messages: [{ id: 'u1', role: 'user', content: 'debug this' }], workspaceName: 'Build', workspacePromptContext: '',
      runtimeRouting: {
        enabled: true,
        forcePremiumWhenLowConfidence: true,
        lowConfidenceThreshold: 0.6,
        premiumFallback: { runtimeProvider: 'ghcp', modelId: 'gpt-5' },
        route: async () => ({ runtimeProvider: 'cursor', modelId: 'claude-4-sonnet', confidence: 0.2, tier: 'standard' }),
      },
    }, { onReasoningStep });
    expect(streamDebuggerChatSpy).toHaveBeenLastCalledWith(expect.objectContaining({ runtimeProvider: 'ghcp', modelId: 'gpt-5' }), { onReasoningStep }, undefined);
    expect(onReasoningStep).toHaveBeenCalledWith(expect.objectContaining({ transcript: expect.stringContaining('low-confidence-premium-escalation') }));
  });



  it('treats shadow mode as a no-op when route returns null', async () => {
    const streamDebuggerChatSpy = vi.spyOn(DebuggerModule, 'streamDebuggerChat').mockResolvedValueOnce();

    await streamAgentChat({
      provider: 'debugger',
      modelId: 'gpt-4.1',
      sessionId: 'session-1',
      latestUserInput: 'quick check',
      messages: [{ id: 'u1', role: 'user', content: 'quick check' }],
      workspaceName: 'Build',
      workspacePromptContext: '',
      runtimeRouting: {
        enabled: true,
        route: async () => null,
      },
    }, {});

    expect(streamDebuggerChatSpy).toHaveBeenCalledWith(expect.objectContaining({ runtimeProvider: 'ghcp', modelId: 'gpt-4.1' }), {}, undefined);
  });

  it('keeps user pin precedence even when low-confidence escalation is configured', async () => {
    const streamDebuggerChatSpy = vi.spyOn(DebuggerModule, 'streamDebuggerChat').mockResolvedValueOnce();

    await streamAgentChat({
      provider: 'debugger',
      modelId: 'gpt-4.1',
      sessionId: 'session-1',
      latestUserInput: 'debug this',
      userPinnedModel: true,
      messages: [{ id: 'u1', role: 'user', content: 'debug this' }],
      workspaceName: 'Build',
      workspacePromptContext: '',
      runtimeRouting: {
        enabled: true,
        forcePremiumWhenLowConfidence: true,
        lowConfidenceThreshold: 0.9,
        premiumFallback: { runtimeProvider: 'ghcp', modelId: 'gpt-5' },
        route: async () => ({ runtimeProvider: 'cursor', modelId: 'claude-4-sonnet', confidence: 0.1, tier: 'standard' }),
      },
    }, {});

    expect(streamDebuggerChatSpy).toHaveBeenCalledWith(expect.objectContaining({ runtimeProvider: 'ghcp', modelId: 'gpt-4.1' }), {}, undefined);
  });

  it('does not apply premium escalation above the low-confidence threshold', async () => {
    const streamDebuggerChatSpy = vi.spyOn(DebuggerModule, 'streamDebuggerChat').mockResolvedValueOnce();

    await streamAgentChat({
      provider: 'debugger',
      modelId: 'gpt-4.1',
      sessionId: 'session-1',
      latestUserInput: 'investigate',
      messages: [{ id: 'u1', role: 'user', content: 'investigate' }],
      workspaceName: 'Build',
      workspacePromptContext: '',
      runtimeRouting: {
        enabled: true,
        forcePremiumWhenLowConfidence: true,
        lowConfidenceThreshold: 0.3,
        premiumFallback: { runtimeProvider: 'ghcp', modelId: 'gpt-5' },
        route: async () => ({ runtimeProvider: 'cursor', modelId: 'claude-4-sonnet', confidence: 0.7, tier: 'standard' }),
      },
    }, {});

    expect(streamDebuggerChatSpy).toHaveBeenCalledWith(expect.objectContaining({ runtimeProvider: 'cursor', modelId: 'claude-4-sonnet' }), {}, undefined);
  });

  it('answers workspace self-reflection directly from the current capability context', async () => {
    const onToken = vi.fn();
    const onDone = vi.fn();

    await streamAgentChat({
      provider: 'codi',
      latestUserInput: 'What are you best at and what skills do you have registered?',
      messages: [{ id: 'user-1', role: 'user', content: 'What are you best at?' }],
      workspaceName: 'Research',
      workspacePromptContext: [
        'Workspace capability files loaded from browser storage:',
        'Workspace memory:',
        '- [project] Use TDD and verify changes.',
        '',
        'Tools: none',
        '',
        'Plugins:',
        '- review-tools (.agents/plugins/review-tools/agent-harness.plugin.json)',
        '',
        'Hooks:',
        '- pre-task.sh (.agents/hooks/pre-task.sh)',
      ].join('\n'),
    }, { onToken, onDone });

    expect(onToken).toHaveBeenCalledWith(expect.stringContaining('active workspace agent for Research'));
    expect(onDone).toHaveBeenCalledWith(expect.stringContaining('review-tools (.agents/plugins/review-tools/agent-harness.plugin.json)'));
    expect(onDone).toHaveBeenCalledWith(expect.stringContaining('pre-task.sh (.agents/hooks/pre-task.sh)'));
    expect(onDone).toHaveBeenCalledWith(expect.stringContaining('Limitations:'));
    expect(onDone).toHaveBeenCalledWith(expect.stringContaining('Best for a human:'));
  });

  it('rejects missing provider requirements', async () => {
    await expect(streamAgentChat({
      provider: 'codi',
      messages: [],
      workspaceName: 'Research',
      workspacePromptContext: '',
    }, {})).rejects.toThrow('Codi chat requires a local model.');

    await expect(streamAgentChat({
      provider: 'ghcp',
      messages: [],
      workspaceName: 'Research',
      workspacePromptContext: '',
    }, {})).rejects.toThrow('GHCP chat requires a modelId and sessionId.');
  });
});
