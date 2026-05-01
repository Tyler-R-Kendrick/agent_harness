import type { IVoter } from 'logact';
import type { CopilotRuntimeState } from '../services/copilotApi';
import type { ChatMessage, HFModel } from '../types';
import type { AgentStreamCallbacks } from './types';
import { getDefaultSecretsManagerAgent, type SecretsManagerAgent } from './Secrets';
import { CODI_LABEL, hasCodiModels, resolveCodiModelId, streamCodiChat } from './Codi';
import { DEBUGGER_LABEL, isDebuggingTaskText, streamDebuggerChat } from './Debugger';
import { GHCP_LABEL, hasGhcpAccess, resolveGhcpModelId, streamGhcpChat } from './Ghcp';
import { isResearchTaskText, RESEARCHER_LABEL, streamResearcherChat } from './Researcher';
import { TOUR_GUIDE_LABEL, isTourGuideTaskText, streamTourGuideChat } from './TourGuide';
import type { AgentProvider, ModelBackedAgentProvider } from './types';

export { CODI_LABEL, buildCodiPrompt, hasCodiModels, resolveCodiModelId, streamCodiChat } from './Codi';
export {
  buildDebuggerOperatingInstructions,
  buildDebuggerSystemPrompt,
  buildDebuggerToolInstructions,
  DEBUGGER_LABEL,
  isDebuggingTaskText,
  streamDebuggerChat,
} from './Debugger';
export { GHCP_LABEL, buildGhcpPrompt, hasGhcpAccess, resolveGhcpModelId, streamGhcpChat } from './Ghcp';
export {
  TOUR_GUIDE_AGENT_ID,
  TOUR_GUIDE_LABEL,
  buildTourGuideAgentPrompt,
  evaluateTourGuideAgentPolicy,
  isTourGuideTaskText,
  streamTourGuideChat,
} from './TourGuide';
export {
  buildResearcherOperatingInstructions,
  buildResearcherSystemPrompt,
  buildResearcherToolInstructions,
  createResearchTaskRecord,
  getResearchArtifactPath,
  getResearchArtifactRoot,
  inferResearchToolHints,
  isResearchTaskText,
  normalizeResearchTaskId,
  rankResearchSources,
  renderResearchTaskMarkdown,
  RESEARCHER_LABEL,
  resolveResearchConflict,
  scoreResearchSource,
  streamResearcherChat,
} from './Researcher';
export {
  COMPOSITE_SEARCH_AGENT_ID,
  COMPOSITE_SEARCH_AGENT_LABEL,
  CompositeSearchAgent,
  DefaultSearchCrawler,
  buildCompositeSearchAgentPrompt,
  compositeSearchResultToWebSearchResult,
  createDefaultSearchReranker,
  createSearchProviderAdapter,
  evaluateCompositeSearchAgentPolicy,
  selectCompositeSearchAgentTools,
} from './Search';
export type {
  CompositeSearchRequest,
  CompositeSearchResult,
  CompositeSearchResultItem,
  SearchContentPlan,
  SearchProviderAdapter,
  SearchProviderResult,
} from './Search';
export {
  WEB_SEARCH_AGENT_ID,
  WEB_SEARCH_AGENT_LABEL,
  buildWebSearchAgentPrompt,
  evaluateWebSearchAgentPrompt,
  selectWebSearchAgentTools,
} from './WebSearch';
export {
  LOCAL_WEB_RESEARCH_AGENT_ID,
  LOCAL_WEB_RESEARCH_AGENT_LABEL,
  LOCAL_WEB_RESEARCH_TOOL_ID,
  LocalWebResearchAgent,
  buildLocalWebResearchAgentPrompt,
  evaluateLocalWebResearchAgentPolicy,
  runLocalWebResearchAgent,
  selectLocalWebResearchAgentTools,
} from './LocalWebResearch';
export {
  RDF_SEMANTIC_SEARCH_TOOL_ID,
  RDF_WEB_SEARCH_AGENT_ID,
  RDF_WEB_SEARCH_AGENT_LABEL,
  buildRdfWebSearchAgentPrompt,
  evaluateRdfWebSearchAgentPolicy,
  runRdfWebSearchAgent,
  selectRdfWebSearchAgentTools,
} from './SemanticSearch';
export type {
  WebResearchRunRequest,
  WebResearchRunResult,
  WebSearchResult,
  ExtractedPage,
  EvidenceChunk,
  AgentCitation,
} from './LocalWebResearch';
export type {
  AgentAnswer as RdfAgentAnswer,
  SearchIntent as RdfSearchIntent,
  SearchResult as RdfSearchResult,
  SearchSource as RdfSearchSource,
} from './SemanticSearch';
export { runAgentLoop, wrapVoterWithCallbacks, type AgentLoopOptions } from './agent-loop';
export type { AgentProvider, AgentStreamCallbacks, ModelBackedAgentProvider } from './types';

export type StreamAgentChatOptions = {
  provider: AgentProvider;
  runtimeProvider?: ModelBackedAgentProvider;
  messages: ChatMessage[];
  workspaceName: string;
  workspacePromptContext: string;
  voters?: IVoter[];
  model?: HFModel;
  modelId?: string;
  sessionId?: string;
  latestUserInput?: string;
  secrets?: SecretsManagerAgent;
};

export async function streamAgentChat(
  options: StreamAgentChatOptions,
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const secrets = options.secrets ?? getDefaultSecretsManagerAgent();
  const messages = await secrets.sanitizeChatMessages(options.messages);
  const workspacePromptContext = (await secrets.sanitizeText(options.workspacePromptContext)).text;
  const latestUserInput = options.latestUserInput === undefined
    ? undefined
    : (await secrets.sanitizeText(options.latestUserInput)).text;

  if (options.provider === 'ghcp') {
    if (!options.modelId || !options.sessionId) {
      throw new Error('GHCP chat requires a modelId and sessionId.');
    }

    await streamGhcpChat({
      modelId: options.modelId,
      sessionId: options.sessionId,
      workspaceName: options.workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput: latestUserInput ?? messages.at(-1)?.content ?? '',
      voters: options.voters,
    }, callbacks, signal);
    return;
  }

  if (options.provider === 'researcher') {
    await streamResearcherChat({
      runtimeProvider: options.runtimeProvider ?? (options.modelId ? 'ghcp' : 'codi'),
      model: options.model,
      modelId: options.modelId,
      sessionId: options.sessionId,
      workspaceName: options.workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput: latestUserInput ?? messages.at(-1)?.content ?? '',
      voters: options.voters,
    }, callbacks, signal);
    return;
  }

  if (options.provider === 'debugger') {
    await streamDebuggerChat({
      runtimeProvider: options.runtimeProvider ?? (options.modelId ? 'ghcp' : 'codi'),
      model: options.model,
      modelId: options.modelId,
      sessionId: options.sessionId,
      workspaceName: options.workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput: latestUserInput ?? messages.at(-1)?.content ?? '',
      voters: options.voters,
    }, callbacks, signal);
    return;
  }

  if (options.provider === 'tour-guide') {
    await streamTourGuideChat({
      workspaceName: options.workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput: latestUserInput ?? messages.at(-1)?.content ?? '',
    }, callbacks, signal);
    return;
  }

  if (!options.model) {
    throw new Error('Codi chat requires a local model.');
  }

  await streamCodiChat({
    model: options.model,
    messages,
    workspaceName: options.workspaceName,
    workspacePromptContext,
    latestUserInput,
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
  researcherRuntimeProvider,
}: {
  provider: AgentProvider;
  activeCodiModelName?: string;
  activeGhcpModelName?: string;
  researcherRuntimeProvider?: ModelBackedAgentProvider;
}): string {
  if (provider === 'researcher' || provider === 'debugger') {
    const modelName = researcherRuntimeProvider === 'ghcp'
      ? (activeGhcpModelName ?? 'Copilot')
      : (activeCodiModelName ?? 'Codi');
    return `${provider === 'researcher' ? RESEARCHER_LABEL : DEBUGGER_LABEL}: ${modelName}`;
  }
  if (provider === 'tour-guide') return TOUR_GUIDE_LABEL;
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
  if (provider === 'researcher') {
    return (hasGhcpModelsReady || hasCodiModelsReady)
      ? 'Ask Researcher…'
      : 'Sign in to GHCP or install a Codi model to research';
  }
  if (provider === 'debugger') {
    return (hasGhcpModelsReady || hasCodiModelsReady)
      ? 'Ask Debugger…'
      : 'Sign in to GHCP or install a Codi model to debug';
  }
  if (provider === 'tour-guide') {
    return 'Ask Tour Guide…';
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
  if (provider === 'researcher') {
    if (hasGhcpAccess(copilotState)) {
      return `${copilotState.models.length} GHCP-backed Researcher models`;
    }
    return installedModels.length
      ? `${installedModels.length} Codi-backed Researcher models`
      : 'Researcher needs GHCP or Codi';
  }
  if (provider === 'debugger') {
    if (hasGhcpAccess(copilotState)) {
      return `${copilotState.models.length} GHCP-backed Debugger models`;
    }
    return installedModels.length
      ? `${installedModels.length} Codi-backed Debugger models`
      : 'Debugger needs GHCP or Codi';
  }
  if (provider === 'tour-guide') {
    return 'Creates guided product tours';
  }
  return `${installedModels.length} Codi models ready`;
}

export function resolveAgentProviderForTask({
  selectedProvider,
  latestUserInput,
}: {
  selectedProvider: AgentProvider;
  latestUserInput: string;
}): AgentProvider {
  if (isResearchTaskText(latestUserInput)) return 'researcher';
  if (isDebuggingTaskText(latestUserInput)) return 'debugger';
  return isTourGuideTaskText(latestUserInput) ? 'tour-guide' : selectedProvider;
}

export function resolveRuntimeAgentProvider({
  provider,
  hasCodiModelsReady,
  hasGhcpModelsReady,
}: {
  provider: AgentProvider;
  hasCodiModelsReady: boolean;
  hasGhcpModelsReady: boolean;
}): ModelBackedAgentProvider {
  if (provider !== 'researcher' && provider !== 'debugger' && provider !== 'tour-guide') return provider;
  if (hasGhcpModelsReady) return 'ghcp';
  return hasCodiModelsReady ? 'codi' : 'ghcp';
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
