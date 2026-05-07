import { describe, expect, it, vi } from 'vitest';
import {
  buildMediaOperatingInstructions,
  buildMediaSystemPrompt,
  buildMediaToolInstructions,
  isMediaTaskText,
  streamMediaChat,
} from './index';
import { planMediaCapabilities } from '../../services/mediaAgent';

vi.mock('@huggingface/transformers', () => ({
  TextStreamer: class MockTextStreamer {},
}));

describe('media agent', () => {
  it('builds first-class Media operating instructions', () => {
    const instructions = buildMediaOperatingInstructions();

    expect(instructions).toContain('# Media');
    expect(instructions).toContain('image generation');
    expect(instructions).toContain('voice generation');
    expect(instructions).toContain('SFX generation');
    expect(instructions).toContain('music generation');
    expect(instructions).toContain('Remotion');
    expect(instructions).toContain('verification');
  });

  it('detects media tasks and builds prompts with capability context', () => {
    expect(isMediaTaskText('Generate an image and voiceover for the launch page.')).toBe(true);
    expect(isMediaTaskText('Make a Remotion video with music and sound effects.')).toBe(true);
    expect(isMediaTaskText('Debug why checkout fails.')).toBe(false);

    const capabilityPlan = planMediaCapabilities({
      request: 'Make a Remotion video with music.',
      installedModels: [],
      remoteModelNames: [],
    });
    const systemPrompt = buildMediaSystemPrompt({ workspaceName: 'Studio', capabilityPlan });
    expect(systemPrompt).toContain('Active workspace: Studio');
    expect(systemPrompt).toContain('## Media Operating Instructions');
    expect(systemPrompt).toContain('## Media Capability Plan');
    expect(systemPrompt).toContain('Remotion video: missing');

    const toolPrompt = buildMediaToolInstructions({
      workspaceName: 'Studio',
      workspacePromptContext: 'Workspace rules.',
      descriptors: [{ id: 'files', label: 'Files', description: 'Write files.' }],
      selectedToolIds: ['files'],
      capabilityPlan,
    });
    expect(toolPrompt).toContain('## Tool Instructions');
    expect(toolPrompt).toContain('Selected tool ids: files');
    expect(toolPrompt).toContain('Write files.');
    expect(toolPrompt).toContain('## Media Operating Instructions');
  });

  it('requires a backing runtime before streaming', async () => {
    await expect(streamMediaChat({
      runtimeProvider: 'ghcp',
      workspaceName: 'Studio',
      workspacePromptContext: '',
      messages: [],
      latestUserInput: 'generate a video',
    }, {})).rejects.toThrow('Media GHCP chat requires a modelId and sessionId.');

    await expect(streamMediaChat({
      runtimeProvider: 'codi',
      workspaceName: 'Studio',
      workspacePromptContext: '',
      messages: [],
      latestUserInput: 'generate a video',
    }, {})).rejects.toThrow('Media Codi chat requires a local model.');
  });
});
