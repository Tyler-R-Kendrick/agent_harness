import type { IVoter } from 'logact';
import type { CopilotRuntimeState } from '../services/copilotApi';
import type { ChatMessage, HFModel } from '../types';
import type { AgentStreamCallbacks } from './types';
import { CODI_LABEL, hasCodiModels, resolveCodiModelId, streamCodiChat } from './Codi';
import { GHCP_LABEL, hasGhcpAccess, resolveGhcpModelId, streamGhcpChat } from './Ghcp';
import type { AgentProvider } from './types';

export { CODI_LABEL, buildCodiPrompt, hasCodiModels, resolveCodiModelId, streamCodiChat } from './Codi';
export { GHCP_LABEL, buildGhcpPrompt, hasGhcpAccess, resolveGhcpModelId, streamGhcpChat } from './Ghcp';
export {
  WEB_SEARCH_AGENT_ID,
  WEB_SEARCH_AGENT_LABEL,
  buildWebSearchAgentPrompt,
  evaluateWebSearchAgentPrompt,
  selectWebSearchAgentTools,
} from './WebSearch';
export { runAgentLoop, wrapVoterWithCallbacks, type AgentLoopOptions } from './agent-loop';
export type { AgentProvider, AgentStreamCallbacks } from './types';

export type StreamAgentChatOptions = {
  provider: AgentProvider;
  messages: ChatMessage[];
  workspaceName: string;
  workspacePromptContext: string;
  voters?: IVoter[];
  model?: HFModel;
  modelId?: string;
  sessionId?: string;
  latestUserInput?: string;
};

export async function streamAgentChat(
  options: StreamAgentChatOptions,
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  if (options.provider === 'ghcp') {
    if (!options.modelId || !options.sessionId) {
      throw new Error('GHCP chat requires a modelId and sessionId.');
    }

    await streamGhcpChat({
      modelId: options.modelId,
      sessionId: options.sessionId,
      workspaceName: options.workspaceName,
      workspacePromptContext: options.workspacePromptContext,
      messages: options.messages,
      latestUserInput: options.latestUserInput ?? options.messages.at(-1)?.content ?? '',
      voters: options.voters,
    }, callbacks, signal);
    return;
  }

  if (!options.model) {
    throw new Error('Codi chat requires a local model.');
  }

  await streamCodiChat({
    model: options.model,
    messages: options.messages,
    workspaceName: options.workspaceName,
    workspacePromptContext: options.workspacePromptContext,
    voters: options.voters,
  }, callbacks, signal);
}

export function getDefaultAgentProvider({
  installedModels,
  copilotState,
}: {
  installedModels: HFModel[];
  copilotState: CopilotRuntimeState;
}): AgentProvider {
  if (hasCodiModels(installedModels)) return 'codi';
  return hasGhcpAccess(copilotState) ? 'ghcp' : 'codi';
}

export function getAgentDisplayName({
  provider,
  activeCodiModelName,
  activeGhcpModelName,
}: {
  provider: AgentProvider;
  activeCodiModelName?: string;
  activeGhcpModelName?: string;
}): string {
  return provider === 'ghcp'
    ? `${GHCP_LABEL}: ${activeGhcpModelName ?? 'Copilot'}`
    : `${CODI_LABEL}: ${activeCodiModelName ?? 'Codi'}`;
}

export function getAgentInputPlaceholder({
  provider,
  hasCodiModelsReady,
  hasGhcpModelsReady,
}: {
  provider: AgentProvider;
  hasCodiModelsReady: boolean;
  hasGhcpModelsReady: boolean;
}): string {
  if (provider === 'ghcp') {
    return hasGhcpModelsReady ? 'Ask GHCP…' : 'Sign in to GHCP to start chatting';
  }
  return hasCodiModelsReady ? 'Ask Codi…' : 'Install a Codi model to start chatting';
}

export function getAgentProviderSummary({
  provider,
  installedModels,
  copilotState,
}: {
  provider: AgentProvider;
  installedModels: HFModel[];
  copilotState: CopilotRuntimeState;
}): string {
  if (provider === 'ghcp') {
    return hasGhcpAccess(copilotState)
      ? `${copilotState.models.length} GHCP models enabled`
      : (copilotState.authenticated ? 'GHCP has no enabled models' : 'GHCP sign-in required');
  }
  return `${installedModels.length} Codi models ready`;
}

export function resolveAgentModelIds({
  installedModels,
  selectedCodiModelId,
  copilotModels,
  selectedGhcpModelId,
}: {
  installedModels: HFModel[];
  selectedCodiModelId: string;
  copilotModels: CopilotRuntimeState['models'];
  selectedGhcpModelId: string;
}) {
  return {
    codiModelId: resolveCodiModelId(installedModels, selectedCodiModelId),
    ghcpModelId: resolveGhcpModelId(copilotModels, selectedGhcpModelId),
  };
}
