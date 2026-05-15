import type { IVoter } from 'logact';
import type { CopilotRuntimeState } from '../services/copilotApi';
import type { CursorRuntimeState } from '../services/cursorApi';
import type { CodexRuntimeState } from '../services/codexApi';
import type { ChatMessage, HFModel } from '../types';
import type { AgentStreamCallbacks } from './types';
import { getDefaultSecretsManagerAgent, type SecretManagementSettings, type SecretsManagerAgent } from './Secrets';
import { CODI_LABEL, hasCodiModels, resolveCodiModelId, streamCodiChat } from './Codi';
import { CODEX_LABEL, hasCodexAccess, resolveCodexModelId, streamCodexChat } from './Codex';
import { DEBUGGER_LABEL, isDebuggingTaskText, streamDebuggerChat } from './Debugger';
import { GHCP_LABEL, hasGhcpAccess, resolveGhcpModelId, streamGhcpChat } from './Ghcp';
import { CURSOR_LABEL, hasCursorAccess, resolveCursorModelId, streamCursorAgentChat } from './Cursor';
import { CONTEXT_MANAGER_LABEL, isContextManagerTaskText, streamContextManagerChat } from './ContextManager';
import { isPlannerTaskText, PLANNER_LABEL, streamPlannerChat } from './Planner';
import { isResearchTaskText, RESEARCHER_LABEL, streamResearcherChat } from './Researcher';
import { isSecurityReviewTaskText, SECURITY_REVIEW_LABEL, streamSecurityReviewChat } from './Security';
import { isSteeringTaskText, STEERING_LABEL, streamSteeringChat } from './Steering';
import { ADVERSARY_LABEL, isAdversaryTaskText, streamAdversaryChat } from './Adversary';
import { isMediaTaskText, MEDIA_LABEL, streamMediaChat } from './Media';
import { AGENT_SWARM_LABEL, isAgentSwarmTaskText, streamAgentSwarmChat } from './Swarm';
import { TOUR_GUIDE_LABEL, isTourGuideTaskText, streamTourGuideChat } from './TourGuide';
import { buildWorkspaceSelfReflectionAnswer, isSelfReflectionTaskText } from '../services/selfReflection';
import type { AgentProvider, ModelBackedAgentProvider } from './types';
import { CHAT_AGENT_SKILLS } from './skillDefinitions';
import { buildRoutingDecisionRecord, persistRoutingDecisionRecord } from '../services/routingObservability';

export type RuntimeRoutingDecision = {
  reasonCode: 'router-disabled' | 'router-selected' | 'user-pinned' | 'low-confidence-premium-escalation';
  confidence: number;
  tier: 'standard' | 'premium';
  selectedBy: 'default' | 'router' | 'user';
};

export type RuntimeRoutingConfig = {
  enabled?: boolean;
  forcePremiumWhenLowConfidence?: boolean;
  lowConfidenceThreshold?: number;
  routingMode?: 'active' | 'shadow';
  route?: (input: {
    provider: AgentProvider;
    modelId?: string;
    latestUserInput: string;
    workspaceName: string;
    sessionId?: string;
  }) => Promise<{
    runtimeProvider: ModelBackedAgentProvider;
    modelId?: string;
    confidence: number;
    tier: 'standard' | 'premium';
    candidateSetSummary?: string;
    fallbackCause?: string | null;
    skillRouteTrace?: {
      selectedSkill: string;
      topAlternatives: Array<{ skill: string; score: number; reasonCode: string }>;
      reasonCodes: string[];
    };
  } | null>;
  premiumFallback?: {
    runtimeProvider: ModelBackedAgentProvider;
    modelId?: string;
  };
};

export { CODI_LABEL, buildCodiPrompt, hasCodiModels, resolveCodiModelId, streamCodiChat } from './Codi';
export { CODEX_LABEL, buildCodexPrompt, hasCodexAccess, resolveCodexModelId, streamCodexChat } from './Codex';
export {
  buildDebuggerOperatingInstructions,
  buildDebuggerSystemPrompt,
  buildDebuggerToolInstructions,
  DEBUGGER_LABEL,
  isDebuggingTaskText,
  streamDebuggerChat,
} from './Debugger';
export { GHCP_LABEL, buildGhcpPrompt, hasGhcpAccess, resolveGhcpModelId, streamGhcpChat } from './Ghcp';
export { CURSOR_LABEL, buildCursorPrompt, hasCursorAccess, resolveCursorModelId, streamCursorAgentChat } from './Cursor';
export {
  CONTEXT_MANAGER_AGENT_ID,
  CONTEXT_MANAGER_CACHE_ROOT,
  CONTEXT_MANAGER_LABEL,
  buildContextManagerOperatingInstructions,
  buildContextManagerSystemPrompt,
  buildContextManagerToolInstructions,
  isContextManagerTaskText,
  streamContextManagerChat,
} from './ContextManager';
export {
  ADVERSARY_LABEL,
  buildAdversaryOperatingInstructions,
  buildAdversarySystemPrompt,
  buildAdversaryToolInstructions,
  isAdversaryTaskText,
  streamAdversaryChat,
} from './Adversary';
export {
  SECURITY_REVIEW_LABEL,
  buildSecurityReviewOperatingInstructions,
  buildSecurityReviewSystemPrompt,
  buildSecurityReviewToolInstructions,
  isSecurityReviewTaskText,
  streamSecurityReviewChat,
} from './Security';
export {
  STEERING_LABEL,
  buildSteeringOperatingInstructions,
  buildSteeringSystemPrompt,
  buildSteeringToolInstructions,
  isSteeringTaskText,
  streamSteeringChat,
} from './Steering';
export {
  MEDIA_AGENT_ID,
  MEDIA_LABEL,
  buildMediaOperatingInstructions,
  buildMediaSystemPrompt,
  buildMediaToolInstructions,
  isMediaTaskText,
  streamMediaChat,
} from './Media';
export {
  AGENT_SWARM_AGENT_ID,
  AGENT_SWARM_LABEL,
  buildAgentSwarmOperatingInstructions,
  buildAgentSwarmSystemPrompt,
  buildAgentSwarmToolInstructions,
  isAgentSwarmTaskText,
  streamAgentSwarmChat,
} from './Swarm';
export {
  TOUR_GUIDE_AGENT_ID,
  TOUR_GUIDE_LABEL,
  buildTourGuideAgentPrompt,
  evaluateTourGuideAgentPolicy,
  isTourGuideTaskText,
  streamTourGuideChat,
} from './TourGuide';
export {
  buildPlannerOperatingInstructions,
  buildPlannerRuntimeSnapshot,
  buildPlannerSystemPrompt,
  buildPlannerToolInstructions,
  createPlannerTaskRecord,
  isPlannerTaskText,
  normalizePlannerTaskId,
  PLANNER_AGENT_ID,
  PLANNER_BOARD_ARTIFACT_PATH,
  PLANNER_LABEL,
  PLANNER_TASK_ARTIFACT_PATH,
  renderPlannerTaskBoardMarkdown,
  streamPlannerChat,
  summarizePlannerRuntime,
  upsertPlannerTask,
} from './Planner';
export type {
  CreatePlannerTaskRecordInput,
  PlannerExternalTaskManagerConfig,
  PlannerExternalTaskManagerKind,
  PlannerExternalTaskManagerMode,
  PlannerExternalTaskRef,
  PlannerMonitoredSession,
  PlannerRuntimeSnapshot,
  PlannerSessionSource,
  PlannerSessionStatus,
  PlannerTaskRecord,
  PlannerTaskSource,
  PlannerTaskStatus,
  PlannerTaskUpdate,
} from './Planner';
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
export type {
  WebResearchRunRequest,
  WebResearchRunResult,
  WebSearchResult,
  ExtractedPage,
  EvidenceChunk,
  AgentCitation,
} from './LocalWebResearch';
export { runAgentLoop, wrapVoterWithCallbacks, type AgentLoopOptions } from './agent-loop';
export type { AgentProvider, AgentStreamCallbacks, ModelBackedAgentProvider } from './types';

export type StreamAgentChatOptions = {
  useDsrRouting?: boolean;
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
  secretSettings?: SecretManagementSettings;
  skipSelfReflection?: boolean;
  runtimeRouting?: RuntimeRoutingConfig;
  userPinnedModel?: boolean;
};

export async function resolveRuntimeModelSelection(options: StreamAgentChatOptions & { latestUserInputText: string }): Promise<{
  runtimeProvider: ModelBackedAgentProvider;
  modelId?: string;
  routingDecision: RuntimeRoutingDecision;
  candidateSetSummary?: string;
  fallbackCause?: string | null;
  skillRouteTrace?: {
    selectedSkill: string;
    topAlternatives: Array<{ skill: string; score: number; reasonCode: string }>;
    reasonCodes: string[];
  };
}> {
  const defaultRuntimeProvider = options.runtimeProvider ?? (options.modelId ? 'ghcp' : 'codi');
  const defaultResult = {
    runtimeProvider: defaultRuntimeProvider,
    modelId: options.modelId,
    candidateSetSummary: 'default-only',
    fallbackCause: null,
    routingDecision: {
      reasonCode: 'router-disabled' as const,
      confidence: 1,
      tier: 'standard' as const,
      selectedBy: 'default' as const,
    },
  };
  if (!options.runtimeRouting?.enabled || !options.runtimeRouting.route) {
    return defaultResult;
  }
  if (options.userPinnedModel && options.modelId) {
    return {
      ...defaultResult,
      routingDecision: { reasonCode: 'user-pinned', confidence: 1, tier: 'standard', selectedBy: 'user' },
    };
  }
  const decision = await options.runtimeRouting.route({
    provider: options.provider,
    modelId: options.modelId,
    latestUserInput: options.latestUserInputText,
    workspaceName: options.workspaceName,
    sessionId: options.sessionId,
  });
  if (!decision) return defaultResult;
  const threshold = options.runtimeRouting.lowConfidenceThreshold ?? 0.5;
  const mustEscalate = Boolean(options.runtimeRouting.forcePremiumWhenLowConfidence) && decision.confidence < threshold;
  if (mustEscalate) {
    const premium = options.runtimeRouting.premiumFallback ?? { runtimeProvider: 'ghcp', modelId: options.modelId };
    return {
      runtimeProvider: premium.runtimeProvider,
      modelId: premium.modelId,
      candidateSetSummary: decision.candidateSetSummary ?? 'benchmark-candidates-evaluated',
      fallbackCause: decision.fallbackCause ?? 'low-confidence-premium-escalation',
      routingDecision: { reasonCode: 'low-confidence-premium-escalation', confidence: decision.confidence, tier: 'premium', selectedBy: 'router' },
    };
  }
  return {
    runtimeProvider: decision.runtimeProvider,
    modelId: decision.modelId ?? options.modelId,
    candidateSetSummary: decision.candidateSetSummary ?? 'benchmark-candidates-evaluated',
    fallbackCause: decision.fallbackCause ?? null,
    routingDecision: { reasonCode: 'router-selected', confidence: decision.confidence, tier: decision.tier, selectedBy: 'router' },
    ...(decision.skillRouteTrace ? { skillRouteTrace: decision.skillRouteTrace } : {}),
  };
}

export async function streamAgentChat(
  options: StreamAgentChatOptions,
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const secrets = options.secrets ?? getDefaultSecretsManagerAgent();
  const messages = await secrets.sanitizeChatMessages(options.messages, options.secretSettings);
  const workspacePromptContext = (await secrets.sanitizeText(options.workspacePromptContext, options.secretSettings)).text;
  const latestUserInput = options.latestUserInput === undefined
    ? undefined
    : (await secrets.sanitizeText(options.latestUserInput, options.secretSettings)).text;
  const latestRequest = latestUserInput ?? messages.at(-1)?.content ?? '';
  const runtimeSelection = await resolveRuntimeModelSelection({ ...options, latestUserInputText: latestRequest });
  const sanitizedSkillRouteTrace = runtimeSelection.skillRouteTrace
    ? {
        selectedSkill: (await secrets.sanitizeText(runtimeSelection.skillRouteTrace.selectedSkill, options.secretSettings)).text,
        topAlternatives: await Promise.all(runtimeSelection.skillRouteTrace.topAlternatives.map(async (item) => ({
          skill: (await secrets.sanitizeText(item.skill, options.secretSettings)).text,
          score: item.score,
          reasonCode: (await secrets.sanitizeText(item.reasonCode, options.secretSettings)).text,
        }))),
        reasonCodes: await Promise.all(runtimeSelection.skillRouteTrace.reasonCodes.map(async (code) => (await secrets.sanitizeText(code, options.secretSettings)).text)),
      }
    : undefined;
  const routingRecord = buildRoutingDecisionRecord({
    requestId: `routing-${Date.now()}`,
    requestText: latestRequest,
    selectedProvider: runtimeSelection.runtimeProvider,
    selectedModel: runtimeSelection.modelId,
    routingDecision: runtimeSelection.routingDecision,
    benchmarkEvidenceSource: options.runtimeRouting?.enabled ? 'benchmark-router' : 'default-router',
    candidateSetSummary: runtimeSelection.candidateSetSummary ?? (options.runtimeRouting?.enabled ? 'benchmark-candidates-evaluated' : 'default-only'),
    fallbackCause: runtimeSelection.fallbackCause
      ?? (runtimeSelection.routingDecision.reasonCode === 'low-confidence-premium-escalation'
        ? 'low-confidence-premium-escalation'
        : null),
    routingMode: options.runtimeRouting?.routingMode ?? 'active',
    skillRouteTrace: sanitizedSkillRouteTrace,
  });
  persistRoutingDecisionRecord(routingRecord);

  callbacks.onReasoningStep?.({
    id: `routing-${Date.now()}`,
    kind: 'thinking',
    title: 'Model routing',
    body: `${runtimeSelection.runtimeProvider}/${runtimeSelection.modelId ?? 'default'} · ${runtimeSelection.routingDecision.reasonCode}`,
    transcript: JSON.stringify(runtimeSelection.routingDecision),
    startedAt: Date.now(),
    endedAt: Date.now(),
    status: 'done',
  });

  if (!options.skipSelfReflection && isSelfReflectionTaskText(latestRequest)) {
    const answer = buildWorkspaceSelfReflectionAnswer({
      task: latestRequest,
      workspaceName: options.workspaceName,
      workspacePromptContext,
      toolDescriptors: [],
    });
    callbacks.onToken?.(answer);
    callbacks.onDone?.(answer);
    return;
  }


  if (options.useDsrRouting) {
    const skill = CHAT_AGENT_SKILLS[options.provider];
    await skill.execute({
      runtimeProvider: runtimeSelection.runtimeProvider,
      model: options.model,
      modelId: runtimeSelection.modelId,
      sessionId: options.sessionId,
      workspaceName: options.workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput: latestUserInput ?? messages.at(-1)?.content ?? '',
    }, callbacks, signal);
    return;
  }

  if (options.provider === 'ghcp') {
    if (!runtimeSelection.modelId || !options.sessionId) {
      throw new Error('GHCP chat requires a modelId and sessionId.');
    }

    await streamGhcpChat({
      modelId: runtimeSelection.modelId,
      sessionId: options.sessionId,
      workspaceName: options.workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput: latestUserInput ?? messages.at(-1)?.content ?? '',
      voters: options.voters,
    }, callbacks, signal);
    return;
  }

  if (options.provider === 'cursor') {
    if (!runtimeSelection.modelId || !options.sessionId) {
      throw new Error('Cursor chat requires a modelId and sessionId.');
    }

    await streamCursorAgentChat({
      modelId: runtimeSelection.modelId,
      sessionId: options.sessionId,
      workspaceName: options.workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput: latestUserInput ?? messages.at(-1)?.content ?? '',
      voters: options.voters,
    }, callbacks, signal);
    return;
  }

  if (options.provider === 'codex') {
    if (!runtimeSelection.modelId || !options.sessionId) {
      throw new Error('Codex chat requires a modelId and sessionId.');
    }

    await streamCodexChat({
      modelId: runtimeSelection.modelId,
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
      runtimeProvider: runtimeSelection.runtimeProvider,
      model: options.model,
      modelId: runtimeSelection.modelId,
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
      runtimeProvider: runtimeSelection.runtimeProvider,
      model: options.model,
      modelId: runtimeSelection.modelId,
      sessionId: options.sessionId,
      workspaceName: options.workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput: latestUserInput ?? messages.at(-1)?.content ?? '',
      voters: options.voters,
    }, callbacks, signal);
    return;
  }

  if (options.provider === 'planner') {
    await streamPlannerChat({
      runtimeProvider: runtimeSelection.runtimeProvider,
      model: options.model,
      modelId: runtimeSelection.modelId,
      sessionId: options.sessionId,
      workspaceName: options.workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput: latestUserInput ?? messages.at(-1)?.content ?? '',
      voters: options.voters,
    }, callbacks, signal);
    return;
  }

  if (options.provider === 'context-manager') {
    await streamContextManagerChat({
      runtimeProvider: runtimeSelection.runtimeProvider,
      model: options.model,
      modelId: runtimeSelection.modelId,
      sessionId: options.sessionId,
      workspaceName: options.workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput: latestUserInput ?? messages.at(-1)?.content ?? '',
      voters: options.voters,
    }, callbacks, signal);
    return;
  }

  if (options.provider === 'security') {
    await streamSecurityReviewChat({
      runtimeProvider: runtimeSelection.runtimeProvider,
      model: options.model,
      modelId: runtimeSelection.modelId,
      sessionId: options.sessionId,
      workspaceName: options.workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput: latestUserInput ?? messages.at(-1)?.content ?? '',
      voters: options.voters,
    }, callbacks, signal);
    return;
  }

  if (options.provider === 'steering') {
    await streamSteeringChat({
      runtimeProvider: runtimeSelection.runtimeProvider,
      model: options.model,
      modelId: runtimeSelection.modelId,
      sessionId: options.sessionId,
      workspaceName: options.workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput: latestUserInput ?? messages.at(-1)?.content ?? '',
      voters: options.voters,
    }, callbacks, signal);
    return;
  }

  if (options.provider === 'adversary') {
    await streamAdversaryChat({
      runtimeProvider: runtimeSelection.runtimeProvider,
      model: options.model,
      modelId: runtimeSelection.modelId,
      sessionId: options.sessionId,
      workspaceName: options.workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput: latestUserInput ?? messages.at(-1)?.content ?? '',
      voters: options.voters,
    }, callbacks, signal);
    return;
  }

  if (options.provider === 'media') {
    await streamMediaChat({
      runtimeProvider: runtimeSelection.runtimeProvider,
      model: options.model,
      modelId: runtimeSelection.modelId,
      sessionId: options.sessionId,
      workspaceName: options.workspaceName,
      workspacePromptContext,
      messages,
      latestUserInput: latestUserInput ?? messages.at(-1)?.content ?? '',
      voters: options.voters,
    }, callbacks, signal);
    return;
  }

  if (options.provider === 'swarm') {
    await streamAgentSwarmChat({
      runtimeProvider: runtimeSelection.runtimeProvider,
      model: options.model,
      modelId: runtimeSelection.modelId,
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
  cursorState,
}: {
  installedModels: HFModel[];
  copilotState: CopilotRuntimeState;
  cursorState?: CursorRuntimeState;
}): AgentProvider {
  if (hasCodiModels(installedModels)) return 'codi';
  if (cursorState && hasCursorAccess(cursorState)) return 'cursor';
  return hasGhcpAccess(copilotState) ? 'ghcp' : 'codi';
}

export function getAgentDisplayName({
  provider,
  activeCodiModelName,
  activeGhcpModelName,
  activeCursorModelName,
  activeCodexModelName,
  researcherRuntimeProvider,
}: {
  provider: AgentProvider;
  activeCodiModelName?: string;
  activeGhcpModelName?: string;
  activeCursorModelName?: string;
  activeCodexModelName?: string;
  researcherRuntimeProvider?: ModelBackedAgentProvider;
}): string {
  if (provider === 'researcher' || provider === 'debugger' || provider === 'planner' || provider === 'context-manager' || provider === 'security' || provider === 'steering' || provider === 'adversary' || provider === 'media' || provider === 'swarm') {
    const modelName = researcherRuntimeProvider === 'ghcp'
      ? (activeGhcpModelName ?? 'Copilot')
      : researcherRuntimeProvider === 'cursor'
        ? (activeCursorModelName ?? 'Cursor')
        : (activeCodiModelName ?? 'Codi');
    const label = provider === 'researcher'
      ? RESEARCHER_LABEL
      : provider === 'debugger'
        ? DEBUGGER_LABEL
        : provider === 'planner'
          ? PLANNER_LABEL
          : provider === 'context-manager'
            ? CONTEXT_MANAGER_LABEL
            : provider === 'security'
              ? SECURITY_REVIEW_LABEL
              : provider === 'steering'
                ? STEERING_LABEL
                : provider === 'adversary'
                  ? ADVERSARY_LABEL
                  : provider === 'media'
                    ? MEDIA_LABEL
                    : AGENT_SWARM_LABEL;
    return `${label}: ${modelName}`;
  }
  if (provider === 'tour-guide') return TOUR_GUIDE_LABEL;
  if (provider === 'cursor') return `${CURSOR_LABEL}: ${activeCursorModelName ?? 'Cursor'}`;
  if (provider === 'codex') return `${CODEX_LABEL}: ${activeCodexModelName ?? 'Codex default'}`;
  return provider === 'ghcp'
    ? `${GHCP_LABEL}: ${activeGhcpModelName ?? 'Copilot'}`
    : `${CODI_LABEL}: ${activeCodiModelName ?? 'Codi'}`;
}

export function getAgentInputPlaceholder({
  provider,
  hasCodiModelsReady,
  hasGhcpModelsReady,
  hasCursorModelsReady = false,
  hasCodexModelsReady = false,
}: {
  provider: AgentProvider;
  hasCodiModelsReady: boolean;
  hasGhcpModelsReady: boolean;
  hasCursorModelsReady?: boolean;
  hasCodexModelsReady?: boolean;
}): string {
  if (provider === 'ghcp') {
    return hasGhcpModelsReady ? 'Ask GHCP…' : 'Sign in to GHCP to start chatting';
  }
  if (provider === 'cursor') {
    return hasCursorModelsReady ? 'Ask Cursor…' : 'Sign in to Cursor to start chatting';
  }
  if (provider === 'codex') {
    return hasCodexModelsReady ? 'Ask Codex…' : 'Sign in to Codex to start chatting';
  }
  if (provider === 'researcher') {
    return (hasGhcpModelsReady || hasCursorModelsReady || hasCodiModelsReady)
      ? 'Ask Researcher…'
      : 'Sign in to GHCP or Cursor, or install a Codi model to research';
  }
  if (provider === 'debugger') {
    return (hasGhcpModelsReady || hasCursorModelsReady || hasCodiModelsReady)
      ? 'Ask Debugger…'
      : 'Sign in to GHCP or Cursor, or install a Codi model to debug';
  }
  if (provider === 'planner') {
    return (hasGhcpModelsReady || hasCursorModelsReady || hasCodiModelsReady)
      ? 'Ask Planner…'
      : 'Sign in to GHCP or Cursor, or install a Codi model to plan';
  }
  if (provider === 'context-manager') {
    return (hasGhcpModelsReady || hasCursorModelsReady || hasCodiModelsReady)
      ? 'Ask Context Manager…'
      : 'Sign in to GHCP or Cursor, or install a Codi model to manage context';
  }
  if (provider === 'security') {
    return (hasGhcpModelsReady || hasCursorModelsReady || hasCodiModelsReady)
      ? 'Ask Security Review…'
      : 'Sign in to GHCP or Cursor, or install a Codi model to review security';
  }
  if (provider === 'steering') {
    return (hasGhcpModelsReady || hasCursorModelsReady || hasCodiModelsReady)
      ? 'Ask Steering...'
      : 'Sign in to GHCP or Cursor, or install a Codi model to update steering';
  }
  if (provider === 'adversary') {
    return (hasGhcpModelsReady || hasCursorModelsReady || hasCodiModelsReady)
      ? 'Ask Adversary…'
      : 'Sign in to GHCP or Cursor, or install a Codi model for adversary review';
  }
  if (provider === 'media') {
    return (hasGhcpModelsReady || hasCursorModelsReady || hasCodiModelsReady)
      ? 'Ask Media…'
      : 'Sign in to GHCP or Cursor, or install media-capable models';
  }
  if (provider === 'swarm') {
    return (hasGhcpModelsReady || hasCursorModelsReady || hasCodiModelsReady)
      ? 'Ask Swarm…'
      : 'Sign in to GHCP or Cursor, or install a Codi model for swarms';
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
  cursorState,
  codexState,
}: {
  provider: AgentProvider;
  installedModels: HFModel[];
  copilotState: CopilotRuntimeState;
  cursorState?: CursorRuntimeState;
  codexState?: CodexRuntimeState;
}): string {
  if (provider === 'ghcp') {
    return hasGhcpAccess(copilotState)
      ? `${copilotState.models.length} GHCP models enabled`
      : (copilotState.authenticated ? 'GHCP has no enabled models' : 'GHCP sign-in required');
  }
  if (provider === 'cursor') {
    if (!cursorState) return 'Cursor sign-in required';
    return hasCursorAccess(cursorState)
      ? `${cursorState.models.length} Cursor models enabled`
      : (cursorState.authenticated ? 'Cursor has no enabled models' : 'Cursor sign-in required');
  }
  if (provider === 'codex') {
    return codexState && hasCodexAccess(codexState)
      ? `${codexState.models.length} Codex models enabled`
      : (codexState?.authenticated ? 'Codex has no enabled models' : 'Codex sign-in required');
  }
  if (provider === 'researcher') {
    if (hasGhcpAccess(copilotState)) {
      return `${copilotState.models.length} GHCP-backed Researcher models`;
    }
    if (cursorState && hasCursorAccess(cursorState)) {
      return `${cursorState.models.length} Cursor-backed Researcher models`;
    }
    return installedModels.length
      ? `${installedModels.length} Codi-backed Researcher models`
      : 'Researcher needs GHCP, Cursor, or Codi';
  }
  if (provider === 'debugger') {
    if (hasGhcpAccess(copilotState)) {
      return `${copilotState.models.length} GHCP-backed Debugger models`;
    }
    if (cursorState && hasCursorAccess(cursorState)) {
      return `${cursorState.models.length} Cursor-backed Debugger models`;
    }
    return installedModels.length
      ? `${installedModels.length} Codi-backed Debugger models`
      : 'Debugger needs GHCP, Cursor, or Codi';
  }
  if (provider === 'planner') {
    if (hasGhcpAccess(copilotState)) {
      return `${copilotState.models.length} GHCP-backed Planner models`;
    }
    if (cursorState && hasCursorAccess(cursorState)) {
      return `${cursorState.models.length} Cursor-backed Planner models`;
    }
    return installedModels.length
      ? `${installedModels.length} Codi-backed Planner models`
      : 'Planner needs GHCP, Cursor, or Codi';
  }
  if (provider === 'context-manager') {
    if (hasGhcpAccess(copilotState)) {
      return `${copilotState.models.length} GHCP-backed Context Manager models`;
    }
    if (cursorState && hasCursorAccess(cursorState)) {
      return `${cursorState.models.length} Cursor-backed Context Manager models`;
    }
    return installedModels.length
      ? `${installedModels.length} Codi-backed Context Manager models`
      : 'Context Manager needs GHCP, Cursor, or Codi';
  }
  if (provider === 'security') {
    if (hasGhcpAccess(copilotState)) {
      return `${copilotState.models.length} GHCP-backed Security Review models`;
    }
    if (cursorState && hasCursorAccess(cursorState)) {
      return `${cursorState.models.length} Cursor-backed Security Review models`;
    }
    return installedModels.length
      ? `${installedModels.length} Codi-backed Security Review models`
      : 'Security Review needs GHCP, Cursor, or Codi';
  }
  if (provider === 'steering') {
    if (hasGhcpAccess(copilotState)) {
      return `${copilotState.models.length} GHCP-backed Steering models`;
    }
    if (cursorState && hasCursorAccess(cursorState)) {
      return `${cursorState.models.length} Cursor-backed Steering models`;
    }
    return installedModels.length
      ? `${installedModels.length} Codi-backed Steering models`
      : 'Steering needs GHCP, Cursor, or Codi';
  }
  if (provider === 'adversary') {
    if (hasGhcpAccess(copilotState)) {
      return `${copilotState.models.length} GHCP-backed Adversary models`;
    }
    if (cursorState && hasCursorAccess(cursorState)) {
      return `${cursorState.models.length} Cursor-backed Adversary models`;
    }
    return installedModels.length
      ? `${installedModels.length} Codi-backed Adversary models`
      : 'Adversary needs GHCP, Cursor, or Codi';
  }
  if (provider === 'media') {
    if (hasGhcpAccess(copilotState)) {
      return `${copilotState.models.length} GHCP-backed Media models`;
    }
    if (cursorState && hasCursorAccess(cursorState)) {
      return `${cursorState.models.length} Cursor-backed Media models`;
    }
    return installedModels.length
      ? `${installedModels.length} Codi-backed Media models`
      : 'Media needs GHCP, Cursor, or media-capable Codi models';
  }
  if (provider === 'swarm') {
    if (hasGhcpAccess(copilotState)) {
      return `${copilotState.models.length} GHCP-backed Swarm models`;
    }
    if (cursorState && hasCursorAccess(cursorState)) {
      return `${cursorState.models.length} Cursor-backed Swarm models`;
    }
    return installedModels.length
      ? `${installedModels.length} Codi-backed Swarm models`
      : 'Swarm needs GHCP, Cursor, or Codi';
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
  if (isSecurityReviewTaskText(latestUserInput)) return 'security';
  if (isSteeringTaskText(latestUserInput)) return 'steering';
  if (isAdversaryTaskText(latestUserInput)) return 'adversary';
  if (isMediaTaskText(latestUserInput)) return 'media';
  if (isAgentSwarmTaskText(latestUserInput)) return 'swarm';
  if (isResearchTaskText(latestUserInput)) return 'researcher';
  if (isDebuggingTaskText(latestUserInput)) return 'debugger';
  if (isContextManagerTaskText(latestUserInput)) return 'context-manager';
  if (isPlannerTaskText(latestUserInput)) return 'planner';
  return isTourGuideTaskText(latestUserInput) ? 'tour-guide' : selectedProvider;
}

export function resolveRuntimeAgentProvider({
  provider,
  hasCodiModelsReady,
  hasGhcpModelsReady,
  hasCursorModelsReady = false,
  hasCodexModelsReady = false,
}: {
  provider: AgentProvider;
  hasCodiModelsReady: boolean;
  hasGhcpModelsReady: boolean;
  hasCursorModelsReady?: boolean;
  hasCodexModelsReady?: boolean;
}): ModelBackedAgentProvider {
  if (provider !== 'researcher' && provider !== 'debugger' && provider !== 'planner' && provider !== 'context-manager' && provider !== 'security' && provider !== 'steering' && provider !== 'adversary' && provider !== 'media' && provider !== 'swarm' && provider !== 'tour-guide') return provider;
  if (hasGhcpModelsReady) return 'ghcp';
  if (hasCursorModelsReady) return 'cursor';
  void hasCodexModelsReady;
  return hasCodiModelsReady ? 'codi' : 'ghcp';
}

export function resolveAgentModelIds({
  installedModels,
  selectedCodiModelId,
  copilotModels,
  selectedGhcpModelId,
  cursorModels = [],
  selectedCursorModelId = '',
  codexModels = [],
  selectedCodexModelId = '',
}: {
  installedModels: HFModel[];
  selectedCodiModelId: string;
  copilotModels: CopilotRuntimeState['models'];
  selectedGhcpModelId: string;
  cursorModels?: CursorRuntimeState['models'];
  selectedCursorModelId?: string;
  codexModels?: CodexRuntimeState['models'];
  selectedCodexModelId?: string;
}) {
  return {
    codiModelId: resolveCodiModelId(installedModels, selectedCodiModelId),
    ghcpModelId: resolveGhcpModelId(copilotModels, selectedGhcpModelId),
    cursorModelId: resolveCursorModelId(cursorModels, selectedCursorModelId),
    codexModelId: resolveCodexModelId(codexModels, selectedCodexModelId),
  };
}
