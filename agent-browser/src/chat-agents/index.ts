import type { CopilotRuntimeState } from '../services/copilotApi';
import type { HFModel } from '../types';
import { CODI_LABEL, hasCodiModels, resolveCodiModelId } from './Codi';
import { GHCP_LABEL, hasGhcpAccess, resolveGhcpModelId } from './Ghcp';
import type { AgentProvider } from './types';

export { CODI_LABEL, buildCodiPrompt, hasCodiModels, resolveCodiModelId, streamCodiChat } from './Codi';
export { GHCP_LABEL, buildGhcpPrompt, hasGhcpAccess, resolveGhcpModelId, streamGhcpChat } from './Ghcp';
export type { AgentProvider, AgentStreamCallbacks } from './types';

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