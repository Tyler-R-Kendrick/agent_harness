import { describe, expect, it } from 'vitest';
import type { HFModel } from '../types';
import {
  DEFAULT_MEDIA_CAPABILITY_REQUIREMENTS,
  buildMediaCapabilityPrompt,
  inferRequestedMediaKinds,
  planMediaCapabilities,
} from './mediaAgent';

const imageModel: HFModel = {
  id: 'local/image-generator',
  name: 'Local image generator',
  author: 'Local',
  task: 'image-generation',
  downloads: 0,
  likes: 0,
  tags: ['image-generation', 'diffusion'],
  sizeMB: 1024,
  status: 'installed',
};

describe('mediaAgent capability planning', () => {
  it('infers requested media kinds from asset-generation language', () => {
    expect(inferRequestedMediaKinds('Generate an image, a voiceover, and a sound effect.')).toEqual([
      'image',
      'voice',
      'sfx',
    ]);
    expect(inferRequestedMediaKinds('Make background music for a Remotion launch video.')).toEqual([
      'music',
      'video',
    ]);
    expect(inferRequestedMediaKinds('Create a campaign asset pack.')).toEqual([
      'image',
      'voice',
      'sfx',
      'music',
      'video',
    ]);
  });

  it('separates ready and missing capabilities with concrete recommendations', () => {
    const plan = planMediaCapabilities({
      request: 'Make a narrated Remotion launch video with music and cover art.',
      installedModels: [imageModel],
      remoteModelNames: ['GPT-4.1'],
    });

    expect(plan.requestedKinds).toEqual(['image', 'voice', 'music', 'video']);
    expect(plan.ready.map((item) => item.kind)).toEqual(['image']);
    expect(plan.missing.map((item) => item.kind)).toEqual(['voice', 'music', 'video']);
    expect(plan.installPrompt).toContain('Voice generation');
    expect(plan.installPrompt).toContain('Remotion video');
    expect(plan.installPrompt).toContain('recommended install');
  });

  it('renders a compact prompt context for orchestration and verification', () => {
    const plan = planMediaCapabilities({
      request: 'Create image, sfx, music, voice, and video assets.',
      installedModels: [imageModel],
      remoteModelNames: ['AudioCraft MusicGen', 'Bark voice model'],
    });

    const prompt = buildMediaCapabilityPrompt(plan);

    expect(DEFAULT_MEDIA_CAPABILITY_REQUIREMENTS).toHaveLength(5);
    expect(prompt).toContain('## Media Capability Plan');
    expect(prompt).toContain('Image generation: ready');
    expect(prompt).toContain('SFX generation: missing');
    expect(prompt).toContain('verification workflow');
  });
});
