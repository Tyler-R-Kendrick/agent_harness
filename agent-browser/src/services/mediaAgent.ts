import type { HFModel } from '../types';

export type MediaAssetKind = 'image' | 'voice' | 'sfx' | 'music' | 'video';
export type MediaCapabilityStatus = 'ready' | 'missing';

export interface MediaCapabilityRequirement {
  kind: MediaAssetKind;
  label: string;
  requiredModels: string[];
  recommendedInstall: string;
  verificationWorkflow: string;
}

export interface MediaCapabilityPlan {
  requestedKinds: MediaAssetKind[];
  requirements: MediaCapabilityRequirement[];
  ready: MediaCapabilityRequirement[];
  missing: MediaCapabilityRequirement[];
  installPrompt: string | null;
}

export interface PlanMediaCapabilitiesInput {
  request: string;
  installedModels: readonly HFModel[];
  remoteModelNames?: readonly string[];
}

const MEDIA_KIND_ORDER: MediaAssetKind[] = ['image', 'voice', 'sfx', 'music', 'video'];

export const DEFAULT_MEDIA_CAPABILITY_REQUIREMENTS: MediaCapabilityRequirement[] = [
  {
    kind: 'image',
    label: 'Image generation',
    requiredModels: ['image-generation', 'diffusion', 'stable-diffusion', 'sdxl', 'flux'],
    recommendedInstall: 'Install a browser-compatible image-generation model such as FLUX.1-schnell or SDXL Turbo.',
    verificationWorkflow: 'Render the generated image, inspect dimensions, and capture visual evidence.',
  },
  {
    kind: 'voice',
    label: 'Voice generation',
    requiredModels: ['text-to-speech', 'tts', 'voice', 'bark', 'speech'],
    recommendedInstall: 'Install a text-to-speech model such as Bark, Kokoro, or a configured voice provider.',
    verificationWorkflow: 'Play the voice clip, verify duration/transcript alignment, and preserve the audio artifact.',
  },
  {
    kind: 'sfx',
    label: 'SFX generation',
    requiredModels: ['audio-generation', 'sound-effect', 'sfx', 'foley', 'audioldm'],
    recommendedInstall: 'Install an audio-generation or Foley/SFX model such as AudioLDM 2.',
    verificationWorkflow: 'Play the effect, confirm it matches the cue sheet, and preserve waveform or playback evidence.',
  },
  {
    kind: 'music',
    label: 'Music generation',
    requiredModels: ['music-generation', 'musicgen', 'audiocraft', 'music'],
    recommendedInstall: 'Install a music-generation model such as AudioCraft MusicGen.',
    verificationWorkflow: 'Play the music bed, verify loop length and loudness target, and preserve the audio artifact.',
  },
  {
    kind: 'video',
    label: 'Remotion video',
    requiredModels: ['remotion', 'video-generation', 'text-to-video', 'video'],
    recommendedInstall: 'Install or enable the Remotion workflow plus any needed image, audio, and narration generators.',
    verificationWorkflow: 'Render a Remotion preview/export, inspect key frames, and capture screenshot or video evidence.',
  },
];

const MEDIA_PATTERNS: Record<MediaAssetKind, RegExp[]> = {
  image: [/\b(image|images|picture|pictures|photo|photos|illustration|cover art|artwork|sprite|thumbnail|poster)\b/i],
  voice: [/\b(voice|voiceover|voice-over|narration|narrate|narrated|narrator|spoken|speech|text-to-speech|tts)\b/i],
  sfx: [/\b(sfx|sound effects?|foley|audio cue|impact sound|ui sound|click sound)\b/i],
  music: [/\b(music|song|score|soundtrack|background track|music bed|jingle|theme)\b/i],
  video: [/\b(video|videos|remotion|motion graphic|animation|animated|rendered clip|promo clip)\b/i],
};

const ASSET_PACK_PATTERN = /\b(asset pack|media pack|campaign assets?|creative assets?|brand kit|launch assets?)\b/i;

function modelEvidence(model: HFModel): string {
  return [
    model.id,
    model.name,
    model.author,
    model.task,
    ...model.tags,
  ].join(' ').toLowerCase();
}

function hasCapability(
  requirement: MediaCapabilityRequirement,
  installedModels: readonly HFModel[],
  remoteModelNames: readonly string[],
): boolean {
  const keywords = requirement.requiredModels.map((keyword) => keyword.toLowerCase());
  const localEvidence = installedModels.some((model) => {
    const evidence = modelEvidence(model);
    return keywords.some((keyword) => evidence.includes(keyword));
  });
  if (localEvidence) return true;

  const remoteEvidence = remoteModelNames.map((name) => name.toLowerCase()).join(' ');
  return keywords.some((keyword) => remoteEvidence.includes(keyword));
}

export function inferRequestedMediaKinds(text: string): MediaAssetKind[] {
  if (ASSET_PACK_PATTERN.test(text)) return [...MEDIA_KIND_ORDER];
  return MEDIA_KIND_ORDER.filter((kind) => MEDIA_PATTERNS[kind].some((pattern) => pattern.test(text)));
}

export function buildMediaInstallPrompt(missing: readonly MediaCapabilityRequirement[]): string | null {
  if (!missing.length) return null;
  const lines = missing.map((requirement) => (
    `- ${requirement.label}: recommended install - ${requirement.recommendedInstall}`
  ));
  return [
    'Media Agent is missing required generation capabilities:',
    ...lines,
  ].join('\n');
}

export function planMediaCapabilities({
  request,
  installedModels,
  remoteModelNames = [],
}: PlanMediaCapabilitiesInput): MediaCapabilityPlan {
  const requestedKinds = inferRequestedMediaKinds(request);
  const kinds = requestedKinds.length ? requestedKinds : [...MEDIA_KIND_ORDER];
  const requirements = DEFAULT_MEDIA_CAPABILITY_REQUIREMENTS.filter((requirement) => kinds.includes(requirement.kind));
  const ready = requirements.filter((requirement) => hasCapability(requirement, installedModels, remoteModelNames));
  const missing = requirements.filter((requirement) => !ready.includes(requirement));
  return {
    requestedKinds: kinds,
    requirements,
    ready,
    missing,
    installPrompt: buildMediaInstallPrompt(missing),
  };
}

export function buildMediaCapabilityPrompt(plan: MediaCapabilityPlan): string {
  const lines = plan.requirements.map((requirement) => {
    const status: MediaCapabilityStatus = plan.ready.includes(requirement) ? 'ready' : 'missing';
    return [
      `- ${requirement.label}: ${status}`,
      `  - required evidence: ${requirement.requiredModels.join(', ')}`,
      `  - recommended install: ${requirement.recommendedInstall}`,
      `  - verification workflow: ${requirement.verificationWorkflow}`,
    ].join('\n');
  });
  return [
    '## Media Capability Plan',
    `Requested asset kinds: ${plan.requestedKinds.join(', ') || 'none detected'}`,
    ...lines,
    plan.installPrompt ? `\n${plan.installPrompt}` : '',
  ].filter(Boolean).join('\n');
}
