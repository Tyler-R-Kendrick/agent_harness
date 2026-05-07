import type { IVoter } from 'logact';
import type { ChatMessage, HFModel } from '../../types';
import type { ToolDescriptor } from '../../tools';
import { buildAgentSystemPrompt, buildToolInstructionsTemplate } from '../../services/agentPromptTemplates';
import { buildMediaCapabilityPrompt, planMediaCapabilities, type MediaCapabilityPlan } from '../../services/mediaAgent';
import { streamCodiChat } from '../Codi';
import { streamGhcpChat } from '../Ghcp';
import { streamCursorAgentChat } from '../Cursor';
import type { AgentStreamCallbacks, ModelBackedAgentProvider } from '../types';

export const MEDIA_AGENT_ID = 'media';
export const MEDIA_LABEL = 'Media';

export function isMediaTaskText(text: string): boolean {
  return /\b(generate|create|make|compose|render|produce|draft|build)\b.*\b(image|picture|photo|illustration|cover art|voice|voiceover|voice-over|narration|speech|tts|sfx|sound effects?|foley|music|song|soundtrack|video|remotion|animation|asset pack|media pack)\b/i.test(text)
    || /\b(image|picture|photo|illustration|cover art|voice|voiceover|voice-over|narration|speech|tts|sfx|sound effects?|foley|music|song|soundtrack|video|remotion|animation|asset pack|media pack)\b.*\b(generate|create|make|compose|render|produce|draft|build)\b/i.test(text);
}

export function buildMediaOperatingInstructions(): string {
  return [
    '# Media',
    '',
    '## Purpose',
    '- Orchestrate browser-agent media generation across specialized asset workflows.',
    '- Coordinate image generation, voice generation, SFX generation, music generation, and Remotion video generation.',
    '- Detect missing model or workflow capabilities before promising an asset.',
    '',
    '## Workflow',
    '1. Classify the requested asset kinds and identify dependencies between them.',
    '2. Check the Media Capability Plan for ready and missing generation capabilities.',
    '3. If capabilities are missing, ask the user to install the recommended models or workflows before generation.',
    '4. Decompose the request into subagent jobs with explicit prompts, inputs, outputs, and verification evidence.',
    '5. For Remotion video, plan script, storyboard, images, voice, SFX, music, render command, and visual verification.',
    '6. Preserve generated artifact paths, acceptance criteria, and playback or screenshot evidence.',
    '',
    '## Constraints',
    '- Do not claim that an image, audio file, music track, or video was generated unless an artifact path or verification result exists.',
    '- Do not silently skip missing media capabilities; present the install recommendation and continue with any ready sub-workflows.',
    '- Keep each media subagent workflow independently verifiable.',
    '',
    '## Deliverables',
    '- Asset breakdown by image, voice, SFX, music, and video.',
    '- Missing model install recommendations when applicable.',
    '- Generated artifact manifest with verification workflow and evidence status.',
  ].join('\n');
}

export function buildMediaSystemPrompt({
  workspaceName,
  modelId,
  capabilityPlan,
}: {
  workspaceName?: string;
  modelId?: string;
  capabilityPlan?: MediaCapabilityPlan;
}): string {
  return [
    buildAgentSystemPrompt({
      workspaceName,
      goal: 'Orchestrate verifiable media generation workflows across image, voice, SFX, music, and Remotion video assets.',
      scenario: 'general-chat',
      constraints: [
        'Treat each media asset type as a separate verifiable subagent workflow.',
        'Prompt for recommended model or workflow installs when required media capabilities are missing.',
        'Do not report generated assets without artifact paths or verification evidence.',
      ],
      agentKind: MEDIA_AGENT_ID,
      modelId,
    }),
    '## Media Operating Instructions',
    buildMediaOperatingInstructions(),
    capabilityPlan ? buildMediaCapabilityPrompt(capabilityPlan) : '',
  ].filter(Boolean).join('\n\n');
}

export function buildMediaToolInstructions({
  workspaceName,
  workspacePromptContext,
  descriptors,
  selectedToolIds,
  selectedGroups,
  capabilityPlan,
}: {
  workspaceName: string;
  workspacePromptContext: string;
  descriptors: readonly Pick<ToolDescriptor, 'id' | 'label' | 'description'>[];
  selectedToolIds?: readonly string[];
  selectedGroups?: readonly string[];
  capabilityPlan?: MediaCapabilityPlan;
}): string {
  return [
    buildMediaSystemPrompt({ workspaceName, capabilityPlan }),
    buildToolInstructionsTemplate({
      workspaceName,
      workspacePromptContext,
      descriptors,
      selectedToolIds,
      selectedGroups,
    }),
  ].join('\n\n');
}

export async function streamMediaChat(
  {
    runtimeProvider,
    model,
    modelId,
    sessionId,
    messages,
    workspaceName,
    workspacePromptContext,
    latestUserInput,
    voters = [],
  }: {
    runtimeProvider: ModelBackedAgentProvider;
    model?: HFModel;
    modelId?: string;
    sessionId?: string;
    messages: ChatMessage[];
    workspaceName: string;
    workspacePromptContext: string;
    latestUserInput: string;
    voters?: IVoter[];
  },
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const capabilityPlan = planMediaCapabilities({
    request: latestUserInput,
    installedModels: model ? [model] : [],
    remoteModelNames: modelId ? [modelId] : [],
  });
  const systemPrompt = buildMediaSystemPrompt({
    workspaceName,
    modelId: runtimeProvider === 'codi' ? model?.id : modelId,
    capabilityPlan,
  });

  if (runtimeProvider === 'ghcp') {
    if (!modelId || !sessionId) {
      throw new Error('Media GHCP chat requires a modelId and sessionId.');
    }
    await streamGhcpChat({ modelId, sessionId, workspaceName, workspacePromptContext, messages, latestUserInput, voters, systemPrompt }, callbacks, signal);
    return;
  }

  if (runtimeProvider === 'cursor') {
    if (!modelId || !sessionId) {
      throw new Error('Media Cursor chat requires a modelId and sessionId.');
    }
    await streamCursorAgentChat({ modelId, sessionId, workspaceName, workspacePromptContext, messages, latestUserInput, voters, systemPrompt }, callbacks, signal);
    return;
  }

  if (!model) {
    throw new Error('Media Codi chat requires a local model.');
  }

  await streamCodiChat({
    model,
    messages,
    workspaceName,
    workspacePromptContext,
    latestUserInput,
    voters,
    systemPrompt,
  }, callbacks, signal);
}
