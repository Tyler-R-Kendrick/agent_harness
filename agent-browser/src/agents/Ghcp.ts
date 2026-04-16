import { streamCopilotChat, type CopilotModelSummary, type CopilotRuntimeState } from '../services/copilotApi';
import { toChatSdkTranscript } from '../services/chatComposition';
import type { ChatMessage } from '../types';
import type { AgentStreamCallbacks } from './types';

export const GHCP_LABEL = 'GHCP';

export function hasGhcpAccess(state: CopilotRuntimeState): boolean {
  return state.available && state.authenticated && state.models.length > 0;
}

export function resolveGhcpModelId(models: CopilotModelSummary[], selectedModelId: string): string {
  return models.some((model) => model.id === selectedModelId)
    ? selectedModelId
    : (models[0]?.id || '');
}

export function buildGhcpPrompt({
  workspaceName,
  workspacePromptContext,
  messages,
  latestUserInput,
}: {
  workspaceName: string;
  workspacePromptContext: string;
  messages: ChatMessage[];
  latestUserInput: string;
}): string {
  const transcript = toChatSdkTranscript(messages)
    .filter((message) => message.text.trim())
    .map((message) => `${message.role}: ${message.text}`)
    .join('\n\n');

  return [
    'You are GHCP, a GitHub Copilot-backed agent for an agent-first browser. Be concise and clear.',
    `Active workspace: ${workspaceName}`,
    workspacePromptContext,
    transcript ? `Conversation transcript:\n${transcript}` : null,
    `Latest user request:\n${latestUserInput.trim()}`,
  ].filter(Boolean).join('\n\n');
}

export async function streamGhcpChat(
  {
    modelId,
    workspaceName,
    workspacePromptContext,
    messages,
    latestUserInput,
  }: {
    modelId: string;
    workspaceName: string;
    workspacePromptContext: string;
    messages: ChatMessage[];
    latestUserInput: string;
  },
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  await streamCopilotChat(
    {
      modelId,
      prompt: buildGhcpPrompt({ workspaceName, workspacePromptContext, messages, latestUserInput }),
    },
    callbacks,
    signal,
  );
}