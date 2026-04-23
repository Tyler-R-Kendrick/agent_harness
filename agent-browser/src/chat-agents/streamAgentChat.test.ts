import { describe, expect, it, vi } from 'vitest';

vi.mock('@huggingface/transformers', () => ({
  TextStreamer: class MockTextStreamer {},
}));

import * as CodiModule from './Codi';
import * as GhcpModule from './Ghcp';
import { streamAgentChat } from './index';

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
      messages: [{ id: 'user-1', role: 'user', content: 'hello' }],
      workspaceName: 'Research',
      workspacePromptContext: 'Use workspace files.',
    }, {});

    expect(streamCodiChatSpy).toHaveBeenCalledWith(expect.objectContaining({
      workspaceName: 'Research',
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