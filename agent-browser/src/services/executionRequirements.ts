import type { ModelMessage } from '@ai-sdk/provider-utils';
import { PayloadType, type AgentBusPayloadMeta, type IAgentBus } from 'logact';
import type { ToolPlanningCallbacks, ToolAgentRuntime, ToolPlan } from '../tool-agents/tool-agent';
import { callTool } from '../tool-agents/tool-agent';
import { WEB_SEARCH_AGENT_ID, WEB_SEARCH_AGENT_LABEL, selectWebSearchAgentTools } from '../chat-agents/WebSearch';
import {
  LOCAL_WEB_RESEARCH_AGENT_ID,
  LOCAL_WEB_RESEARCH_AGENT_LABEL,
  type EvidenceChunk as LocalEvidenceChunk,
  type WebResearchRunResult,
  type WebSearchResult as LocalWebSearchResult,
} from '../chat-agents/LocalWebResearch';
import type { AgentRunResult } from './agentRunner';
import type { BusEntryStep, SearchTurnContext, ValidationContract } from '../types';
import { compileValidationContract } from './constraintCompiler';
import {
  resolveConversationSearchContext,
  type ConversationSearchResolution,
} from './conversationSearchContext';

export interface ExecutionRequirement {
  kind: 'location' | 'web-search';
  reason: string;
}

export interface ExecutionIntent {
  currentTaskText: string;
  subject: string;
  answerSubject: string;
  rankingModifier?: string;
  rankingGoal?: 'best' | 'worst' | 'closest' | 'most-popular' | 'recommended' | 'current' | 'open-now' | 'highly-rated' | 'family-friendly' | 'budget-friendly' | 'quiet' | 'nearby';
  locationRequired: boolean;
  externalSearchRequired: boolean;
  topicPreferences: string[];
  prefersCitations: boolean;
  requestedCount?: number;
  excludedCandidateNames: string[];
  validationContract: ValidationContract;
}

export interface SearchCandidate {
  name: string;
  url: string;
  snippet: string;
  rank: number;
  sourceOrder: number;
  sourceQuality: number;
  needsLinkEnrichment: boolean;
  mentions: number;
  sources: string[];
  reasons: string[];
  validationEvidence: string[];
  confidence: number;
  evidenceKind?: 'direct-result' | 'ranked-list' | 'listed-snippet' | 'page-entity' | 'page-link' | 'page-text-list';
  validationStatus?: 'accepted' | 'rejected';
  subjectMatch?: boolean;
  entityLink?: string;
  sourceEvidence?: string[];
  subjectEvidence?: string[];
  locationEvidence?: string[];
  linkEvidence?: 'entity-specific' | 'aggregate' | 'invalid' | 'unknown';
  validationFailures?: string[];
}

export interface ValidatedSearchCandidate extends SearchCandidate {
  validationStatus: 'accepted';
  subjectMatch: true;
  entityLink: string;
  sourceEvidence: string[];
  subjectEvidence: string[];
  locationEvidence: string[];
  validationFailures: [];
}

interface RejectedSearchCandidate {
  name: string;
  validationStatus: 'rejected';
  validationFailures: string[];
  evidence?: string[];
}

export interface ResolvedExecutionContext {
  requirements: ExecutionRequirement[];
  intent?: ExecutionIntent;
  location?: string;
  memoryResult?: unknown;
  searchQuery?: string;
  webSearchResult?: SearchWebResult;
  localWebResearchResult?: WebResearchRunResult;
  searchResult?: SearchWebResult;
  searchCandidates?: SearchCandidate[];
  conversationResolution?: ConversationSearchResolution;
}

export type RequirementResolutionResult =
  | { status: 'continue'; steps: number; context?: ResolvedExecutionContext }
  | { status: 'fulfilled'; steps: number; result: AgentRunResult; context: ResolvedExecutionContext }
  | { status: 'blocked'; steps: number; result: AgentRunResult; context: ResolvedExecutionContext };

export interface ExecutionInstructionContext {
  action?: string;
  toolPolicy?: {
    allowedToolIds: string[];
    assignments: Record<string, string[]>;
  };
  busEntries?: BusEntryStep[];
  validationCriteria?: string[];
  validationContract?: ValidationContract;
  bus?: IAgentBus;
}

interface ResolveExecutionRequirementsOptions {
  runtime: ToolAgentRuntime;
  plan: ToolPlan;
  messages: ModelMessage[];
  executionContext?: ExecutionInstructionContext;
  callbacks: ToolPlanningCallbacks;
}

type SearchWebResult = {
  status: 'found' | 'empty' | 'unavailable';
  query: string;
  results: Array<{ title: string; url: string; snippet: string }>;
  reason?: string;
};

type SearchWebItem = SearchWebResult['results'][number];

type ReadWebPageResult = {
  status: 'read' | 'unavailable' | 'blocked';
  url: string;
  title?: string;
  text?: string;
  links: Array<{ text: string; url: string }>;
  jsonLd: unknown[];
  entities: Array<{ name: string; url?: string; evidence: string }>;
  observations: Array<{
    kind: 'json-ld' | 'page-link' | 'heading' | 'text-span';
    label: string;
    url?: string;
    evidence: string;
    localContext?: string;
    sourceUrl: string;
  }>;
  reason?: string;
};

interface SearchAnalysisDecision {
  accepted: SearchCandidate[];
  rejected: string[];
  nextAction: 'answer' | 'read-pages' | 'search-more' | 'blocked';
  rationale: string;
}

interface CandidateValidation {
  validationFailures: string[];
  subjectEvidence: string[];
  locationEvidence: string[];
  linkEvidence: SearchCandidate['linkEvidence'];
  sourceEvidence: string[];
}

const REQUIREMENT_TOOL_IDS = {
  recall: 'webmcp:recall_user_context',
  location: 'webmcp:read_browser_location',
  elicit: 'webmcp:elicit_user_input',
  search: 'webmcp:search_web',
  localWebResearch: 'webmcp:local_web_research',
  readPage: 'webmcp:read_web_page',
} as const;

const MAX_PAGES_TO_READ = 2;
const MAX_DISCOVERY_SEARCH_RESULTS = 5;
const MAX_CANDIDATES_TO_ENRICH = 4;
const FORBIDDEN_ENTITY_LABEL_PATTERN = /^(?:movies?|theaters?|theatres?|cinemas?|trailers?|teasers?|videos?|clips?|tv shows?|showtimes?|tickets?|reviews?|menus?|directions?|hours?|locations?|search|find|home|main content|skip to main content|skip navigation|privacy|terms|sign in|log in|login|join|join now|subscribe|load more|see all|view all|read more|learn more)$/i;
const FORBIDDEN_ENTITY_LABEL_WORD_PATTERN = /\b(?:overview|trailers?|teasers?|showt?imes?|movie\s+times?|tickets?|ticketing|tv shows?|streaming|coming\s+soon|movie\s+charts?|movie\s+news|skip to main content|main content|screen\s+reader|accessibility|promo(?:tion)?s?|offers?|coupon|redeem|support\s+enable|join\s+now\s+enable|enable\s+dark\s+mode|shop\s+categories|about\s+us)\b/i;
const SITE_SECTION_LABEL_PATTERN = /^(?:at\s+home|coming\s+soon|streaming|fan\s*store|store|shop|shop\s+categories|merchandise|gear|gift cards?|rewards?|offers?|deals?|coupons?|promos?|promotions?|charts?|news|articles?|blog|photos?|videos?|clips?|trailers?|tv shows?|events?|calendar|account|profile|help|support|support\s+enable|contact|about|about\s+us|join\s+now(?:\s+enable)?|enable\s+dark\s+mode|screen\s+reader\s+users?|accessibility|ticketing)$/i;
const TECHNICAL_ARTIFACT_LABEL_PATTERN = /^(?:(?:multi|single|top|bottom|side|leaderboard|banner|box|native|display|sponsor(?:ed)?)\s+)?(?:ad|ads|adunit|adunits|advertisement|banner|logo|multi\s+logo|box\s+ad|tracking|analytics|pixel|beacon|script|style|stylesheet|css|font|font\s+family|serif|sans\s+serif|arial|helvetica|georgia|palatino|palatino\s+linotype|times\s+new\s+roman)$/i;
const TECHNICAL_ARTIFACT_WORD_PATTERN = /\b(?:adconfig|adunit|adunits|advertis(?:e|ing|ement)|doubleclick|googletag|analytics|tracking|pixel|font-family|stylesheet|css|script|window\.[a-z0-9_$]+|pageType|theaterselectionpage)\b/i;
const CONTENT_NAVIGATION_ARTIFACT_WORD_PATTERN = /\b(?:featured|ticketing|what\s+to\s+watch|watch\s+new|new\s+trailers?|made\s+in\s+hollywood|showt?imes?\s+highlights?|trending|content\s+(?:area|bucket|section)|screenx|fan\s*club|sign\s*in\/?join|support\s+enable|join\s+now\s+enable|enable\s+dark\s+mode|shop\s+categories|about\s+us)\b/i;
const MOVIE_TIME_DIRECTORY_LABEL_PATTERN = /^(?:(?:movie\s+times?|movies?)\s+by\s+(?:cities|city|states?|zip(?:\s+codes?)?)|(?:cities|city|states?|zip(?:\s+codes?)?)\s+movie\s+times?)$/i;
const US_STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  newhampshire: 'NH',
  newjersey: 'NJ',
  newmexico: 'NM',
  newyork: 'NY',
  northcarolina: 'NC',
  northdakota: 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  rhodeisland: 'RI',
  southcarolina: 'SC',
  southdakota: 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  westvirginia: 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
};
const US_STATE_ABBRS = new Set(Object.values(US_STATE_NAME_TO_ABBR));

export async function resolveExecutionRequirements({
  runtime,
  plan,
  messages,
  executionContext,
  callbacks,
}: ResolveExecutionRequirementsOptions): Promise<RequirementResolutionResult> {
  const conversationResolution = resolveConversationSearchContext(messages);
  const effectiveMessages = conversationResolution.needsClarification
    ? messages
    : conversationResolution.messages;
  const intent = inferExecutionIntent(
    effectiveMessages,
    conversationResolution,
    executionContext?.validationContract,
    executionContext?.validationCriteria,
  );
  const requirements = conversationResolution.needsClarification
    ? [{ kind: 'web-search' as const, reason: 'The follow-up request needs a prior searchable context before tools can run.' }]
    : detectRequirements(intent);
  if (requirements.length === 0) {
    return { status: 'continue', steps: 0 };
  }

  const allowedToolIds = new Set([
    ...plan.selectedToolIds,
    ...(executionContext?.toolPolicy?.allowedToolIds ?? []),
  ]);
  let steps = 0;
  const context: ResolvedExecutionContext = { requirements, intent, conversationResolution };
  const call = async (toolId: string, args: unknown) => {
    steps += 1;
    const toolOwner = resolveAssignedToolOwner(toolId, executionContext?.toolPolicy?.assignments ?? plan.actorToolAssignments);
    return callObservedTool(
      runtime,
      toolId,
      args,
      callbacks,
      steps,
      executionContext?.bus,
      executionContext?.validationCriteria ?? [],
      intent.validationContract,
      toolOwner,
    );
  };

  await appendConversationContext(executionContext?.bus, conversationResolution, intent);

  if (conversationResolution.needsClarification) {
    const blocked = await blockForClarification({
      allowedToolIds,
      runtime,
      call,
      steps,
      clarificationPrompt: conversationResolution.clarificationPrompt ?? 'What should I show more of?',
    });
    return { status: 'blocked', steps: blocked.steps, result: blocked.result, context };
  }

  if (intent.locationRequired) {
    const resolved = await resolveLocation({
      runtime,
      allowedToolIds,
      taskText: intent.currentTaskText,
      messages: effectiveMessages,
      contractLocation: requestedContractLocation(intent.validationContract),
      call,
    });
    context.location = resolved.location;
    context.memoryResult = resolved.memoryResult;
    applyMemoryPreferences(intent, resolved.memoryResult);
    if (!context.location) {
      const blocked = await blockForMissingLocation({ allowedToolIds, runtime, call, steps, intent });
      return { status: 'blocked', steps: blocked.steps, result: blocked.result, context };
    }
  } else if (isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.recall)) {
    context.memoryResult = await call(REQUIREMENT_TOOL_IDS.recall, { limit: 10 });
    applyMemoryPreferences(intent, context.memoryResult);
  }

  if (intent.externalSearchRequired) {
    if (
      !hasAvailableSearchPath(runtime, allowedToolIds)
      && !hasAvailableLocalWebResearchPath(runtime, allowedToolIds)
    ) {
      const blocked = await blockForMissingSearch({
        allowedToolIds,
        runtime,
        call,
        steps,
        location: context.location,
        intent,
      });
      return { status: 'blocked', steps: blocked.steps, result: blocked.result, context };
    }
    context.searchQuery = buildSearchQuery(intent, context.location);
    const webSearchPromise = hasAvailableSearchPath(runtime, allowedToolIds)
      ? searchWebWithFallback({
        runtime,
        allowedToolIds,
        query: context.searchQuery,
        limit: 3,
        call,
      })
      : Promise.resolve({
        status: 'unavailable' as const,
        query: context.searchQuery,
        results: [],
        reason: 'No web search tool is available.',
      });
    const localWebResearchPromise = localWebResearchWithFallback({
      runtime,
      allowedToolIds,
      question: intent.currentTaskText,
      query: context.searchQuery,
      limit: Math.max(3, intent.requestedCount ?? 3),
      call,
    });
    const [webSearchResult, localWebResearchResult] = await Promise.all([
      webSearchPromise,
      localWebResearchPromise,
    ]);
    context.webSearchResult = webSearchResult;
    context.localWebResearchResult = localWebResearchResult;
    const mergedSearchResult = mergeSearchFanInResults(webSearchResult, localWebResearchResult, intent);
    context.searchResult = mergedSearchResult;
    await appendSearchFanIn(executionContext?.bus, webSearchResult, localWebResearchResult, mergedSearchResult);
    if (mergedSearchResult.status === 'found' && mergedSearchResult.results.length > 0) {
      context.searchCandidates = await fulfillSearchCandidates({
        searchResult: mergedSearchResult,
        intent,
        location: context.location,
        allowedToolIds,
        runtime,
        bus: executionContext?.bus,
        call,
      });
      const text = composeSearchAnswer(context);
      const acceptedCount = acceptedSearchCandidateCount(context);
      const requiredCount = requiredAcceptedCandidateCount(intent);
      if (acceptedCount < requiredCount) {
        return {
          status: 'fulfilled',
          steps,
          result: {
            text,
            steps,
            ...(acceptedCount === 0
              ? {
                failed: true,
                error: `No validated ${intent.answerSubject} candidates were found in the search evidence.`,
              }
              : {}),
            searchTurnContext: buildSearchTurnContext(context),
          },
          context,
        };
      }
      return {
        status: 'fulfilled',
        steps,
        result: { text, steps, searchTurnContext: buildSearchTurnContext(context) },
        context,
      };
    }
    const blocked = await blockForMissingSearch({
      allowedToolIds,
      runtime,
      call,
      steps,
      location: context.location,
      intent,
      reason: mergedSearchResult.reason,
    });
    return { status: 'blocked', steps: blocked.steps, result: blocked.result, context };
  }

  return { status: 'continue', steps, context };
}

async function resolveLocation({
  runtime,
  allowedToolIds,
  taskText,
  messages,
  contractLocation,
  call,
}: {
  runtime: ToolAgentRuntime;
  allowedToolIds: Set<string>;
  taskText: string;
  messages: ModelMessage[];
  contractLocation?: string;
  call: (toolId: string, args: unknown) => Promise<unknown>;
}): Promise<{ location?: string; memoryResult?: unknown }> {
  let memoryResult: unknown;
  if (isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.recall)) {
    memoryResult = await call(REQUIREMENT_TOOL_IDS.recall, { limit: 10 });
    const recalled = extractRecalledLocation(memoryResult);
    if (recalled) return { location: recalled, memoryResult };
  }

  const sessionLocation = extractSessionLocation(messages);
  if (sessionLocation) return { location: sessionLocation, memoryResult };

  if (isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.location)) {
    const location = await call(REQUIREMENT_TOOL_IDS.location, {});
    const browserLocation = extractBrowserLocation(location);
    if (browserLocation) return { location: browserLocation, memoryResult };
    const browserCoordinates = extractBrowserCoordinates(location);
    if (browserCoordinates) {
      const normalizedLocation = await resolveCoordinateLocation({
        coordinates: browserCoordinates,
        runtime,
        allowedToolIds,
        call,
      });
      if (normalizedLocation) return { location: normalizedLocation, memoryResult };
      return { location: extractStatedLocation(taskText) ?? contractLocation, memoryResult };
    }
  }

  return { location: extractStatedLocation(taskText) ?? contractLocation, memoryResult };
}

async function blockForClarification({
  allowedToolIds,
  runtime,
  call,
  steps,
  clarificationPrompt,
}: {
  allowedToolIds: Set<string>;
  runtime: ToolAgentRuntime;
  call: (toolId: string, args: unknown) => Promise<unknown>;
  steps: number;
  clarificationPrompt: string;
}): Promise<{ steps: number; result: AgentRunResult }> {
  if (isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.elicit)) {
    const elicitation = await call(REQUIREMENT_TOOL_IDS.elicit, {
      prompt: clarificationPrompt,
      reason: 'A follow-up request needs the prior search subject before tools can run.',
      fields: [{
        id: 'search-context',
        label: 'What should I show more of?',
        required: true,
        placeholder: 'bars near Arlington Heights, IL',
      }],
    });
    return {
      steps: steps + 1,
      result: resultFromNeedsUserInput(elicitation, steps + 1) ?? {
        text: clarificationPrompt,
        steps: steps + 1,
        blocked: true,
        needsUserInput: true,
      },
    };
  }
  return {
    steps,
    result: {
      text: clarificationPrompt,
      steps,
      blocked: true,
      needsUserInput: true,
    },
  };
}

async function blockForMissingLocation({
  allowedToolIds,
  runtime,
  call,
  steps,
  intent,
}: {
  allowedToolIds: Set<string>;
  runtime: ToolAgentRuntime;
  call: (toolId: string, args: unknown) => Promise<unknown>;
  steps: number;
  intent: ExecutionIntent;
}): Promise<{ steps: number; result: AgentRunResult }> {
  const prompt = `What city or neighborhood should I use for this ${intent.answerSubject} search?`;
  if (isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.elicit)) {
    const elicitation = await call(REQUIREMENT_TOOL_IDS.elicit, {
      prompt,
      reason: 'A location is required before I can answer a nearby request.',
      fields: [{
        id: 'location',
        label: 'City or neighborhood',
        required: true,
        placeholder: 'Chicago, IL',
      }],
    });
    return {
      steps: steps + 1,
      result: resultFromNeedsUserInput(elicitation, steps + 1) ?? {
        text: prompt,
        steps: steps + 1,
        blocked: true,
        needsUserInput: true,
      },
    };
  }
  return {
    steps,
    result: {
      text: prompt,
      steps,
      blocked: true,
      needsUserInput: true,
    },
  };
}

async function blockForMissingSearch({
  allowedToolIds,
  runtime,
  call,
  steps,
  location,
  intent,
  reason,
}: {
  allowedToolIds: Set<string>;
  runtime: ToolAgentRuntime;
  call: (toolId: string, args: unknown) => Promise<unknown>;
  steps: number;
  location?: string;
  intent: ExecutionIntent;
  reason?: string;
}): Promise<{ steps: number; result: AgentRunResult }> {
  const prompt = [
    location
      ? `I found your location, but web search is unavailable. Please provide a search source or candidate results for ${intent.answerSubject}.`
      : 'I need a search source or candidate results before I can answer this external-fact request.',
    reason ? `Search issue: ${reason}` : null,
  ].filter(Boolean).join('\n');
  if (isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.elicit)) {
    const elicitation = await call(REQUIREMENT_TOOL_IDS.elicit, {
      prompt,
      reason: reason ?? 'Web search could not provide source results for the task.',
      fields: [{
        id: 'search-source',
        label: 'Search source or candidates',
        required: true,
        placeholder: `Paste a link, source, or candidates for ${intent.answerSubject}`,
      }],
    });
    return {
      steps: steps + 1,
      result: resultFromNeedsUserInput(elicitation, steps + 1) ?? {
        text: prompt,
        steps: steps + 1,
        blocked: true,
        needsUserInput: true,
      },
    };
  }
  return {
    steps,
    result: {
      text: prompt,
      steps,
      blocked: true,
      needsUserInput: true,
    },
  };
}

async function searchWebWithFallback({
  runtime,
  allowedToolIds,
  query,
  limit,
  call,
}: {
  runtime: ToolAgentRuntime;
  allowedToolIds: Set<string>;
  query: string;
  limit: number;
  call: (toolId: string, args: unknown) => Promise<unknown>;
}): Promise<SearchWebResult> {
  const attempts: SearchWebResult[] = [];
  const attemptedToolIds = new Set<string>();

  if (isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.search)) {
    attemptedToolIds.add(REQUIREMENT_TOOL_IDS.search);
    const result = normalizeSearchToolResult(
      await call(REQUIREMENT_TOOL_IDS.search, { query, limit }),
      query,
    );
    if (result.status === 'found' && result.results.length > 0) return result;
    attempts.push(result);
  }

  for (const toolId of fallbackSearchToolIds(runtime, allowedToolIds)) {
    if (attemptedToolIds.has(toolId)) continue;
    attemptedToolIds.add(toolId);
    const args = toolId === 'cli'
      ? { command: buildCliWebSearchCommand(query, limit) }
      : { query, limit };
    const result = normalizeSearchToolResult(await call(toolId, args), query);
    if (result.status === 'found' && result.results.length > 0) return result;
    attempts.push(result);
  }

  const reasons = attempts.map((attempt) => attempt.reason).filter((reason): reason is string => Boolean(reason));
  return {
    status: attempts.some((attempt) => attempt.status === 'empty') ? 'empty' : 'unavailable',
    query,
    results: [],
    ...(reasons.length ? { reason: uniqueStrings(reasons).join(' ') } : { reason: 'No web search tool returned results.' }),
  };
}

function hasAvailableSearchPath(runtime: ToolAgentRuntime, allowedToolIds: Set<string>): boolean {
  return isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.search)
    || fallbackSearchToolIds(runtime, allowedToolIds).length > 0;
}

function hasAvailableLocalWebResearchPath(runtime: ToolAgentRuntime, allowedToolIds: Set<string>): boolean {
  return isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.localWebResearch);
}


function fallbackSearchToolIds(runtime: ToolAgentRuntime, allowedToolIds: Set<string>): string[] {
  return selectWebSearchAgentTools(allRuntimeDescriptors(runtime), '')
    .filter((toolId) => toolId !== REQUIREMENT_TOOL_IDS.search)
    .filter((toolId) => toolId !== REQUIREMENT_TOOL_IDS.readPage)
    .filter((toolId) => isToolAllowedAndAvailable(runtime, allowedToolIds, toolId));
}

function allRuntimeDescriptors(runtime: ToolAgentRuntime): ToolDescriptorLike[] {
  return [...runtime.descriptors, ...(runtime.generatedDescriptors ?? [])];
}

type ToolDescriptorLike = Parameters<typeof selectWebSearchAgentTools>[0][number];

function normalizeSearchToolResult(result: unknown, query: string): SearchWebResult {
  return normalizeSearchResult(parseStructuredToolOutput(result), query);
}

async function localWebResearchWithFallback({
  runtime,
  allowedToolIds,
  question,
  query,
  limit,
  call,
}: {
  runtime: ToolAgentRuntime;
  allowedToolIds: Set<string>;
  question: string;
  query: string;
  limit: number;
  call: (toolId: string, args: unknown) => Promise<unknown>;
}): Promise<WebResearchRunResult | undefined> {
  if (!isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.localWebResearch)) {
    return undefined;
  }
  return normalizeLocalWebResearchResult(
    await call(REQUIREMENT_TOOL_IDS.localWebResearch, {
      question,
      queries: [query],
      maxSearchResults: Math.max(3, limit),
      maxPagesToExtract: Math.max(2, Math.min(5, limit)),
      maxEvidenceChunks: Math.max(3, limit),
      synthesize: false,
    }),
    question,
  );
}

function normalizeLocalWebResearchResult(result: unknown, question: string): WebResearchRunResult {
  const parsed = parseStructuredToolOutput(result);
  if (!isRecord(parsed)) {
    return emptyLocalWebResearchResult(question, [{
      stage: 'error',
      message: 'Local web research did not return a structured result.',
      recoverable: true,
    }]);
  }
  const searchResults = Array.isArray(parsed.searchResults)
    ? parsed.searchResults
      .map(normalizeLocalWebSearchResult)
      .filter((item): item is LocalWebSearchResult => Boolean(item))
    : [];
  const evidence = Array.isArray(parsed.evidence)
    ? parsed.evidence
      .map(normalizeLocalEvidenceChunk)
      .filter((item): item is LocalEvidenceChunk => Boolean(item))
    : [];
  const errors = Array.isArray(parsed.errors)
    ? parsed.errors
      .map((error) => {
        if (!isRecord(error)) return null;
        const stage = typeof error.stage === 'string' && isLocalAgentWorkflowStep(error.stage) ? error.stage : 'error';
        const message = typeof error.message === 'string' ? error.message : '';
        const url = typeof error.url === 'string' ? error.url : undefined;
        const recoverable = typeof error.recoverable === 'boolean' ? error.recoverable : true;
        return message ? { stage, message, ...(url ? { url } : {}), recoverable } : null;
      })
      .filter((error): error is WebResearchRunResult['errors'][number] => Boolean(error))
    : [];
  return {
    id: typeof parsed.id === 'string' ? parsed.id : `local-web-research-${Date.now()}`,
    question: typeof parsed.question === 'string' ? parsed.question : question,
    plannedQueries: Array.isArray(parsed.plannedQueries)
      ? parsed.plannedQueries.filter((item): item is string => typeof item === 'string')
      : [question],
    searchResults,
    extractedPages: [],
    evidence,
    citations: [],
    ...(typeof parsed.answer === 'string' ? { answer: parsed.answer } : {}),
    errors,
    timings: {},
    elapsedMs: typeof parsed.elapsedMs === 'number' ? parsed.elapsedMs : 0,
    createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date(0).toISOString(),
  };
}

function isLocalAgentWorkflowStep(value: string): value is WebResearchRunResult['errors'][number]['stage'] {
  return [
    'planning',
    'searching',
    'extracting',
    'ranking',
    'synthesizing',
    'complete',
    'error',
  ].includes(value);
}

function emptyLocalWebResearchResult(
  question: string,
  errors: WebResearchRunResult['errors'],
): WebResearchRunResult {
  return {
    id: `local-web-research-${Date.now()}`,
    question,
    plannedQueries: [question],
    searchResults: [],
    extractedPages: [],
    evidence: [],
    citations: [],
    errors,
    timings: {},
    elapsedMs: 0,
    createdAt: new Date(0).toISOString(),
  };
}

function normalizeLocalWebSearchResult(value: unknown): LocalWebSearchResult | null {
  if (!isRecord(value)) return null;
  const title = typeof value.title === 'string' && value.title.trim() ? decodeHtmlEntities(value.title).trim() : undefined;
  const url = typeof value.url === 'string' && value.url.trim() ? value.url.trim() : undefined;
  const normalizedUrl = typeof value.normalizedUrl === 'string' && value.normalizedUrl.trim()
    ? value.normalizedUrl.trim()
    : url;
  if (!title || !url || !normalizedUrl) return null;
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id.trim() : `local-${title}`,
    title,
    url,
    normalizedUrl,
    ...(typeof value.snippet === 'string' && value.snippet.trim() ? { snippet: decodeHtmlEntities(value.snippet).trim() } : {}),
    provider: value.provider === 'searxng' ? 'searxng' : 'custom',
    ...(typeof value.engine === 'string' ? { engine: value.engine } : {}),
    ...(typeof value.score === 'number' ? { score: value.score } : {}),
    rank: typeof value.rank === 'number' ? value.rank : 1,
    ...(typeof value.publishedDate === 'string' ? { publishedDate: value.publishedDate } : {}),
  };
}

function normalizeLocalEvidenceChunk(value: unknown): LocalEvidenceChunk | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : undefined;
  const url = typeof value.url === 'string' && value.url.trim() ? value.url.trim() : undefined;
  const normalizedUrl = typeof value.normalizedUrl === 'string' && value.normalizedUrl.trim()
    ? value.normalizedUrl.trim()
    : url;
  const text = typeof value.text === 'string' && value.text.trim() ? decodeHtmlEntities(value.text).trim() : undefined;
  if (!id || !url || !normalizedUrl || !text) return null;
  return {
    id,
    url,
    normalizedUrl,
    ...(typeof value.title === 'string' && value.title.trim() ? { title: decodeHtmlEntities(value.title).trim() } : {}),
    text,
    score: typeof value.score === 'number' ? value.score : 0,
    ...(typeof value.sourceResultId === 'string' ? { sourceResultId: value.sourceResultId } : {}),
    ...(typeof value.pageId === 'string' ? { pageId: value.pageId } : {}),
    ...(typeof value.citationId === 'number' ? { citationId: value.citationId } : {}),
  };
}


function mergeSearchFanInResults(
  webResult: SearchWebResult,
  localResearch: WebResearchRunResult | undefined,
  intent: ExecutionIntent,
): SearchWebResult {
  const localItems = localResearch
    ? localResearchToSearchItems(localResearch, intent)
    : [];
  if (localItems.length === 0) return webResult;
  const mergedResults = dedupeSearchItems([...localItems, ...webResult.results]);
  const reasons = [
    webResult.reason,
    ...(localResearch?.errors.map((error) => error.message) ?? []),
  ].filter((reason): reason is string => Boolean(reason));
  return {
    status: 'found',
    query: webResult.query || localResearch?.question || intent.currentTaskText,
    results: mergedResults,
    ...(reasons.length ? { reason: uniqueStrings(reasons).join(' ') } : {}),
  };
}

function localResearchToSearchItems(
  localResearch: WebResearchRunResult,
  intent: ExecutionIntent,
): SearchWebItem[] {
  const evidenceItems = localResearch.evidence.map((chunk, index) => ({
    title: chunk.title ?? sourceNameFromUrl(chunk.url) ?? `Local research source ${index + 1}`,
    url: chunk.url,
    snippet: [
      `${chunk.title ?? sourceNameFromUrl(chunk.url) ?? 'This source'} is a source-backed local web research result.`,
      chunk.text,
      `Local web research source supports this candidate for ${intent.answerSubject}.`,
      chunk.url,
    ].filter(Boolean).join(' '),
    localResearchScore: chunk.score,
    localResearchRank: index + 1,
  } as SearchWebItem & { localResearchScore: number; localResearchRank: number }));
  const searchItems = localResearch.searchResults.map((result) => ({
    title: result.title,
    url: result.url,
    snippet: [
      result.snippet,
      `Local SearXNG result supports this candidate for ${intent.answerSubject}.`,
      result.url,
    ].filter(Boolean).join(' '),
    localSearchRank: result.rank,
  } as SearchWebItem & { localSearchRank: number }));
  return dedupeSearchItems([...evidenceItems, ...searchItems]);
}


function dedupeSearchItems(items: SearchWebItem[]): SearchWebItem[] {
  const seen = new Set<string>();
  const deduped: SearchWebItem[] = [];
  for (const item of items) {
    const key = `${item.title.toLocaleLowerCase()}\u0000${item.url.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function parseStructuredToolOutput(result: unknown): unknown {
  if (typeof result === 'string') return parseJsonFromString(result) ?? result;
  if (isRecord(result)) {
    for (const key of ['stdout', 'output', 'text']) {
      const value = result[key];
      if (typeof value === 'string') {
        const parsed = parseJsonFromString(value);
        if (parsed) return parsed;
      }
    }
  }
  return result;
}

function parseJsonFromString(value: string): unknown | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const jsonBlock = trimmed.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonBlock) return null;
    try {
      return JSON.parse(jsonBlock);
    } catch {
      return null;
    }
  }
}

function buildCliWebSearchCommand(query: string, limit: number): string {
  const script = [
    'const query = process.argv[1] || "";',
    'const limit = Math.max(1, Math.min(10, Number(process.argv[2] || 5)));',
    'const providers = [`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, `https://www.bing.com/search?q=${encodeURIComponent(query)}`];',
    'const strip = (value) => value.replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();',
    'const decode = (value) => strip(value).replace(/&amp;/g, "&").replace(/&quot;/g, "\\"").replace(/&#39;/g, "\'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");',
    'const parse = (html) => {',
    '  const out = [];',
    '  for (const match of html.matchAll(/<a[^>]*class=["\'][^"\']*result__a[^"\']*["\'][^>]*href=["\']([^"\']+)["\'][^>]*>([\\s\\S]*?)<\\/a>[\\s\\S]*?<a[^>]*class=["\'][^"\']*result__snippet[^"\']*["\'][^>]*>([\\s\\S]*?)<\\/a>/gi)) out.push({ url: match[1], title: decode(match[2]), snippet: decode(match[3]) });',
    '  for (const match of html.matchAll(/<li\\b[^>]*class=["\'][^"\']*\\bb_algo\\b[^"\']*["\'][^>]*>([\\s\\S]*?)<\\/li>/gi)) { const link = match[1].match(/<h2\\b[^>]*>\\s*<a\\b[^>]*href=["\']([^"\']+)["\'][^>]*>([\\s\\S]*?)<\\/a>\\s*<\\/h2>/i); const snip = match[1].match(/<p\\b[^>]*>([\\s\\S]*?)<\\/p>/i); if (link) out.push({ url: link[1], title: decode(link[2]), snippet: decode(snip?.[1] || "") }); }',
    '  return out.filter((item) => item.title && item.url).slice(0, limit);',
    '};',
    '(async () => {',
    '  const reasons = [];',
    '  for (const url of providers) {',
    '    try {',
    '      const response = await fetch(url, { headers: { "User-Agent": "agent-browser-cli-search/0.1", "Accept": "text/html" } });',
    '      if (!response.ok) { reasons.push(`provider returned ${response.status}`); continue; }',
    '      const results = parse(await response.text());',
    '      if (results.length) { console.log(JSON.stringify({ status: "found", query, results })); return; }',
    '      reasons.push("no results");',
    '    } catch (error) { reasons.push(error && error.message ? error.message : String(error)); }',
    '  }',
    '  console.log(JSON.stringify({ status: "unavailable", query, reason: reasons.join(" "), results: [] }));',
    '})();',
  ].join('\n');
  return `node -e ${shellQuote(script)} ${shellQuote(query)} ${Math.max(1, Math.min(10, Math.floor(limit)))}`;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function callObservedTool(
  runtime: ToolAgentRuntime,
  toolId: string,
  args: unknown,
  callbacks: ToolPlanningCallbacks,
  step: number,
  bus?: IAgentBus,
  validationCriteria: string[] = [],
  validationContract?: ValidationContract,
  assignedOwner?: string,
): Promise<unknown> {
  const toolCallId = `execution-requirement-${step}`;
  const ownerMeta = toolOwnerMeta(toolId, assignedOwner);
  callbacks.onToolCall?.(toolId, args, toolCallId);
  try {
    const result = await callTool(runtime, toolId, args);
    callbacks.onToolResult?.(toolId, args, result, false, toolCallId);
    await appendToolResult(bus, toolId, result, step, false, ownerMeta);
    await appendToolValidation(bus, toolId, args, result, step, false, validationCriteria, validationContract, ownerMeta);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    callbacks.onToolResult?.(toolId, args, message, true, toolCallId);
    await appendToolResult(bus, toolId, message, step, true, ownerMeta);
    await appendToolValidation(bus, toolId, args, message, step, true, validationCriteria, validationContract, ownerMeta);
    return { status: 'unavailable', reason: message };
  }
}

function resolveAssignedToolOwner(
  toolId: string,
  assignments: Record<string, string[]> | undefined,
): string | undefined {
  if (!assignments) return undefined;
  return Object.entries(assignments)
    .find(([actorId, toolIds]) => (
      (actorId === WEB_SEARCH_AGENT_ID
        || actorId === LOCAL_WEB_RESEARCH_AGENT_ID)
      && toolIds.includes(toolId)
    ))
    ?.[0];
}

function toolOwnerMeta(toolId: string, assignedOwner: string | undefined): AgentBusPayloadMeta {
  if (assignedOwner === WEB_SEARCH_AGENT_ID) {
    return {
      actorId: WEB_SEARCH_AGENT_ID,
      actorRole: 'search-agent',
      parentActorId: 'execute-plan',
      branchId: `agent:${WEB_SEARCH_AGENT_ID}`,
      agentLabel: WEB_SEARCH_AGENT_LABEL,
      modelProvider: 'logact',
    };
  }
  if (assignedOwner === LOCAL_WEB_RESEARCH_AGENT_ID) {
    return {
      actorId: LOCAL_WEB_RESEARCH_AGENT_ID,
      actorRole: 'search-agent',
      parentActorId: 'execute-plan',
      branchId: `agent:${LOCAL_WEB_RESEARCH_AGENT_ID}`,
      agentLabel: LOCAL_WEB_RESEARCH_AGENT_LABEL,
      modelProvider: 'deterministic-local-web',
    };
  }
  return {
    actorId: toolId,
    actorRole: 'tool',
    parentActorId: 'execute-plan',
    branchId: 'agent:executor',
    agentLabel: toolId,
    modelProvider: 'tool',
  };
}

async function appendToolResult(
  bus: IAgentBus | undefined,
  toolId: string,
  result: unknown,
  step: number,
  isError = false,
  meta: AgentBusPayloadMeta,
): Promise<void> {
  if (!bus || typeof bus.append !== 'function') return;
  const output = stringifyForBus(result);
  await bus.append({
    type: PayloadType.Result,
    intentId: `executor-tool-${step}-${toolId.replace(/[^a-z0-9_-]+/gi, '-')}`,
    output,
    ...(isError ? { error: output } : {}),
    meta,
  });
}

async function appendToolValidation(
  bus: IAgentBus | undefined,
  toolId: string,
  args: unknown,
  result: unknown,
  step: number,
  isError: boolean,
  criteria: string[],
  validationContract?: ValidationContract,
  ownerMeta?: AgentBusPayloadMeta,
): Promise<void> {
  if (!bus || typeof bus.append !== 'function') return;
  const resultText = stringifyForBus(result);
  const failedByStatus = isRecord(result)
    && typeof result.status === 'string'
    && /^(?:unavailable|blocked|error|failed)$/i.test(result.status);
  await bus.append({
    type: PayloadType.Result,
    intentId: `validate-tool-call-${step}-${toolId.replace(/[^a-z0-9_-]+/gi, '-')}`,
    output: JSON.stringify({
      type: 'validation-result',
      loop: 'recursive-tool-call-validation',
      scope: 'tool-call',
      toolId,
      step,
      passed: !isError && !failedByStatus,
      criteria: [
        'recursive-tool-call-validation: validate this tool result before any follow-up tool call consumes it.',
        'Tool result must be structured enough to support the next action.',
        'Tool result must not be an execution error unless the executor is returning failure to LogAct.',
        ...criteria,
      ],
      validationContract,
      args,
      outputPreview: resultText.length > 500 ? `${resultText.slice(0, 497)}...` : resultText,
    }),
    ...(isError || failedByStatus ? { error: resultText } : {}),
    meta: {
      actorId: 'validation-agent',
      actorRole: 'verifier',
      parentActorId: ownerMeta?.actorId ?? toolId,
      branchId: ownerMeta?.branchId ?? 'agent:executor',
      agentLabel: 'Validation Agent',
      modelProvider: 'logact',
    },
  });
}

function stringifyForBus(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function detectRequirements(intent: ExecutionIntent): ExecutionRequirement[] {
  const requirements: ExecutionRequirement[] = [];
  if (intent.locationRequired) {
    requirements.push({ kind: 'location', reason: 'The task depends on the user location.' });
  }
  if (intent.externalSearchRequired) {
    requirements.push({ kind: 'web-search', reason: 'The task needs source results beyond stored user context.' });
  }
  return requirements;
}

function inferExecutionIntent(
  messages: ModelMessage[],
  conversationResolution?: ConversationSearchResolution,
  inheritedValidationContract?: ValidationContract,
  legacyCriteria: string[] = [],
): ExecutionIntent {
  const currentTaskText = taskFromMessages(messages);
  const subject = conversationResolution?.resolvedSubject ?? inferSubject(currentTaskText);
  const answerSubject = normalizeAnswerSubject(subject);
  const rankingGoal = inferRankingGoal(currentTaskText);
  const requestedCount = conversationResolution?.requestedCount;
  const excludedCandidateNames = conversationResolution?.excludedCandidateNames ?? [];
  const validationContract = compileValidationContract({
    taskText: currentTaskText,
    resolvedTaskText: conversationResolution?.resolvedTaskText,
    context: conversationResolution?.context,
    subject: answerSubject,
    location: conversationResolution?.inheritedLocation ?? extractStatedLocation(currentTaskText),
    requestedCount,
    excludedCandidateNames,
    legacyCriteria: [
      ...(inheritedValidationContract?.legacyCriteria ?? []),
      ...legacyCriteria,
    ],
  });
  const locationRequired = isLocationDependentTask(currentTaskText)
    || Boolean(conversationResolution?.inheritedLocation)
    || validationContract.constraints.some((constraint) => constraint.type === 'location' && constraint.required);
  const externalSearchRequired = requiresExternalSearch(currentTaskText)
    || validationContract.constraints.some((constraint) => [
      'count',
      'location',
      'name_prefix',
      'name_suffix',
      'rhyme',
      'exclusion',
    ].includes(constraint.type));
  return {
    currentTaskText,
    subject,
    answerSubject,
    rankingModifier: rankingGoalToQueryPrefix(rankingGoal),
    rankingGoal,
    locationRequired,
    externalSearchRequired,
    topicPreferences: [],
    prefersCitations: false,
    requestedCount,
    excludedCandidateNames,
    validationContract,
  };
}

function isLocationDependentTask(text: string): boolean {
  return /\b(near me|nearby|around me|close to me|in my area|near us|around us|closest|nearest)\b/i.test(text)
    || /\blocal\s+(?:restaurants?|bars?|cafes?|coffee|theat(?:er|re)s?|parks?|shops?|stores?|venues?|events?)\b/i.test(text)
    || Boolean(extractStatedLocation(text));
}

function requiresExternalSearch(text: string): boolean {
  return /\b(best|top|worst|closest|nearest|popular|highest rated|open now|family-friendly|budget-friendly|quiet|recommend|recommendations?|search|find|list|show|give|provide|look\s+up|lookup|nearby|near me|around me|current|latest|today|showtimes?|reviews?|options?)\b/i.test(text);
}

function buildSearchQuery(intent: ExecutionIntent, location?: string): string {
  const normalizedLocation = location ? cleanDisplayLocation(location).replace(/,/g, '') : '';
  const preferencePart = compatibleTopicPreferences(intent).join(' ');
  const constraintPart = searchQueryConstraintTerms(intent.validationContract).join(' ');
  return [intent.rankingModifier, preferencePart, intent.subject, normalizedLocation, constraintPart]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim() || intent.subject;
}

function requestedContractLocation(contract: ValidationContract): string | undefined {
  const locationConstraint = contract.constraints.find((constraint) => (
    constraint.type === 'location'
    && constraint.required
    && constraint.operator !== 'outside'
    && typeof constraint.value === 'string'
  ));
  if (typeof locationConstraint?.value !== 'string') return undefined;
  const location = cleanDisplayLocation(locationConstraint.value);
  return isConcreteLocation(location) ? location : undefined;
}

function isConcreteLocation(value: string): boolean {
  return value.trim().length > 0
    && !/^(?:me|us|my area|our area|here|nearby)$/i.test(value.trim());
}

function searchQueryConstraintTerms(contract: ValidationContract): string[] {
  return contract.constraints.flatMap((constraint) => {
    if (!constraint.required || constraint.value === undefined) return [];
    switch (constraint.type) {
      case 'name_prefix':
        return [`starts with ${constraint.value}`];
      case 'name_suffix':
        return [`ends with ${constraint.value}`];
      case 'rhyme':
        return [`rhymes with ${constraint.value}`];
      default:
        return [];
    }
  });
}

function inferRankingGoal(text: string): ExecutionIntent['rankingGoal'] {
  if (/\b(worst|lowest rated|most disliked)\b/i.test(text)) return 'worst';
  if (/\b(closest|nearest)\b/i.test(text)) return 'closest';
  if (/\b(most popular|popular)\b/i.test(text)) return 'most-popular';
  if (/\b(open now)\b/i.test(text)) return 'open-now';
  if (/\b(highest rated|highly rated)\b/i.test(text)) return 'highly-rated';
  if (/\b(family-friendly|family friendly)\b/i.test(text)) return 'family-friendly';
  if (/\b(budget-friendly|budget friendly|cheap|affordable)\b/i.test(text)) return 'budget-friendly';
  if (/\b(quiet)\b/i.test(text)) return 'quiet';
  if (/\b(latest|current|today)\b/i.test(text)) return 'current';
  if (/\b(best|top)\b/i.test(text)) return 'best';
  if (/\b(recommend|recommendations?)\b/i.test(text)) return 'recommended';
  if (/\b(near me|nearby|around me)\b/i.test(text)) return 'nearby';
  return undefined;
}

function rankingGoalToQueryPrefix(goal: ExecutionIntent['rankingGoal']): string | undefined {
  switch (goal) {
    case 'worst':
      return 'worst';
    case 'closest':
      return 'closest';
    case 'most-popular':
      return 'most popular';
    case 'open-now':
      return 'open now';
    case 'highly-rated':
      return 'highest rated';
    case 'family-friendly':
      return 'family-friendly';
    case 'budget-friendly':
      return 'budget-friendly';
    case 'quiet':
      return 'quiet';
    case 'current':
      return 'current';
    case 'best':
      return 'best';
    case 'recommended':
      return 'recommended';
    case 'nearby':
      return 'nearby';
    default:
      return undefined;
  }
}

function inferSubject(text: string): string {
  const normalized = normalizeNaturalLanguage(text)
    .replace(/\borchestrator task \d+ of \d+ \([^)]+\)\.?/ig, ' ')
    .replace(/\bworkspace:\s*[^.]+\.?/ig, ' ')
    .replace(/\boriginal request:\s*/ig, ' ')
    .replace(/\benhanced task prompt:\s*/ig, ' ')
    .replace(/\bcompletion contract:.*$/ig, ' ')
    .replace(/\bsequence dependency:.*$/ig, ' ');
  const cleaned = normalized
    .replace(/\b(?:what|which|where)\s+(?:are|is|were|was|would be|do you think are|do you think is)\b/ig, ' ')
    .replace(/\b(?:what about|how about|what else about|also what about)\b/ig, ' ')
    .replace(/\b(?:can you|could you|please|i need|show me|show|give me|give|provide|suggest|tell me|help me|look up|search for|find|list|recommend)\b/ig, ' ')
    .replace(/\b(?:the|a|an)\b/ig, ' ')
    .replace(/\b(?:best|top|worst|closest|nearest|popular|most popular|recommended|recommendations?|options?|results?)\b/ig, ' ')
    .replace(/\b(?:near me|nearby|around me|close to me|in my area|near us|around us)\b/ig, ' ')
    .replace(/\b(?:current|latest|today)\b/ig, ' ')
    .replace(/^\s*\d+\s+/g, ' ')
    .replace(/\b(?:near|in|around|located in|outside|that|which|who|with|where)\b.*$/ig, ' ')
    .replace(/\?+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalizeAnswerSubject(cleaned || 'results');
}

function normalizeAnswerSubject(subject: string): string {
  const compact = subject
    .replace(/[.;:,\s]+$/g, '')
    .replace(/^[.;:,\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!compact) return 'results';
  if (/\bfor students\b/i.test(compact)) return compact;
  const words = compact.split(' ');
  const last = words.at(-1) ?? '';
  if (/s$|x$|z$|ch$|sh$/i.test(last)) return compact;
  if (last.endsWith('y') && !/[aeiou]y$/i.test(last)) {
    return [...words.slice(0, -1), `${last.slice(0, -1)}ies`].join(' ');
  }
  return [...words.slice(0, -1), `${last}s`].join(' ');
}

function extractRecalledLocation(result: unknown): string | undefined {
  if (!isRecord(result) || result.status !== 'found' || !Array.isArray(result.memories)) return undefined;
  for (const memory of result.memories) {
    if (!isRecord(memory)) continue;
    const label = typeof memory.label === 'string' ? memory.label : '';
    const value = typeof memory.value === 'string' ? memory.value.trim() : '';
    if (value && /\b(location|city|neighbou?rhood|where|address)\b/i.test(`${label} ${memory.id ?? ''} ${value}`)) {
      return cleanDisplayLocation(value);
    }
  }
  const firstValue = result.memories
    .map((memory) => (isRecord(memory) && typeof memory.value === 'string' ? memory.value.trim() : ''))
    .find(Boolean);
  return firstValue ? cleanDisplayLocation(firstValue) : undefined;
}

function applyMemoryPreferences(intent: ExecutionIntent, result: unknown): void {
  if (!isRecord(result) || result.status !== 'found' || !Array.isArray(result.memories)) return;
  const preferences: string[] = [];
  for (const memory of result.memories) {
    if (!isRecord(memory)) continue;
    const label = typeof memory.label === 'string' ? memory.label : '';
    const id = typeof memory.id === 'string' ? memory.id : '';
    const value = typeof memory.value === 'string' ? memory.value.trim() : '';
    const haystack = `${id} ${label} ${value}`;
    if (/\bcitations?\b/i.test(haystack) && /\b(prefer|format|citation|source)\b/i.test(haystack)) {
      intent.prefersCitations = true;
    }
    if (!value || !/\b(prefer|preference|favorite|likes?|cuisine|format|citation)\b/i.test(haystack)) continue;
    if (/\bcitations?\b/i.test(value)) continue;
    preferences.push(value);
  }
  intent.topicPreferences = [...new Set(preferences.map((value) => value.toLowerCase()))];
}

function compatibleTopicPreferences(intent: ExecutionIntent): string[] {
  return intent.topicPreferences
    .filter((preference) => isPreferenceCompatibleWithSubject(preference, intent.answerSubject))
    .map((preference) => preference
      .replace(/\b(?:i\s+)?prefer\b/gi, '')
      .replace(/\b(?:food|cuisine|restaurants?)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean)
    .slice(0, 2);
}

function isPreferenceCompatibleWithSubject(preference: string, subject: string): boolean {
  const lowerSubject = subject.toLocaleLowerCase();
  const lowerPreference = preference.toLocaleLowerCase();
  if (/\b(food|cuisine|restaurant|dining|indian|thai|mexican|italian|japanese|chinese|vegan|vegetarian)\b/.test(lowerPreference)) {
    return /\b(restaurant|restaurants|food|dining|cafe|cafes|coffee|bar|bars)\b/.test(lowerSubject);
  }
  const preferenceTokens = tokenSet(lowerPreference);
  const subjectTokens = tokenSet(lowerSubject);
  return overlapScore(preferenceTokens, subjectTokens) > 0;
}

type BrowserCoordinates = {
  latitude: number;
  longitude: number;
};

function extractBrowserLocation(result: unknown): string | undefined {
  if (!isRecord(result) || result.status !== 'available') return undefined;
  const city = typeof result.city === 'string' ? result.city.trim() : '';
  const state = typeof result.state === 'string' ? result.state.trim() : '';
  const region = typeof result.region === 'string' ? result.region.trim() : '';
  const location = normalizeCityStateLocation([city, state || region].filter(Boolean).join(', '));
  return location && isConcreteLocation(location) ? location : undefined;
}

function extractBrowserCoordinates(result: unknown): BrowserCoordinates | undefined {
  if (!isRecord(result) || result.status !== 'available') return undefined;
  const latitude = typeof result.latitude === 'number' && Number.isFinite(result.latitude) ? result.latitude : null;
  const longitude = typeof result.longitude === 'number' && Number.isFinite(result.longitude) ? result.longitude : null;
  if (latitude === null || longitude === null) return undefined;
  return {
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
  };
}

async function resolveCoordinateLocation({
  coordinates,
  runtime,
  allowedToolIds,
  call,
}: {
  coordinates: BrowserCoordinates;
  runtime: ToolAgentRuntime;
  allowedToolIds: Set<string>;
  call: (toolId: string, args: unknown) => Promise<unknown>;
}): Promise<string | undefined> {
  if (!isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.search)) return undefined;
  const coordinateText = `${formatCoordinate(coordinates.latitude)} ${formatCoordinate(coordinates.longitude)}`;
  const query = `city state for coordinates ${coordinateText}`;
  const result = normalizeSearchResult(
    await call(REQUIREMENT_TOOL_IDS.search, { query, limit: 3 }),
    query,
  );
  if (result.status !== 'found') return undefined;
  return result.results
    .map((item) => normalizeCityStateLocation(`${item.title}. ${item.snippet}`))
    .find((location): location is string => Boolean(location));
}

function normalizeCityStateLocation(value: string): string | undefined {
  const normalized = decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  const statePattern = [...US_STATE_ABBRS, ...Object.keys(US_STATE_NAME_TO_ABBR)]
    .map(escapeRegExp)
    .join('|');
  const cityStatePattern = new RegExp(
    `\\b([A-Z][A-Za-z'.-]+(?:\\s+[A-Z][A-Za-z'.-]+){0,4}),?\\s+(${statePattern})\\b`,
    'gi',
  );
  const matches = [...normalized.matchAll(cityStatePattern)];
  for (const match of matches.reverse()) {
    const city = match[1]
      .replace(/^(?:(?:Coordinates?|Location|Approximate|Resolve|Resolves|For|Near|In|The|Are|Is|Located|To)\b\s*)+/i, '')
      .trim();
    const state = normalizeStateAbbreviation(match[2]);
    if (city && state && !US_STATE_ABBRS.has(city.toUpperCase())) {
      return `${city}, ${state}`;
    }
  }
  return undefined;
}

function normalizeStateAbbreviation(value: string): string | undefined {
  const normalized = value.replace(/\s+/g, '').toLocaleLowerCase();
  const upper = value.toUpperCase();
  if (US_STATE_ABBRS.has(upper)) return upper;
  return US_STATE_NAME_TO_ABBR[normalized];
}

function formatCoordinate(value: number): string {
  return roundCoordinate(value).toFixed(2);
}

function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatJoinedList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function extractStatedLocation(text: string): string | undefined {
  const stateWithComma = text.match(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*,\s*[A-Z]{2})\b/);
  if (stateWithComma) return cleanDisplayLocation(stateWithComma[1]);
  const stateWithoutComma = text.match(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+\s+(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY))\b/);
  if (stateWithoutComma) return cleanDisplayLocation(stateWithoutComma[1]);
  const near = text.match(/\b(?:in|around|for)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})\b/);
  return near?.[1] ? cleanDisplayLocation(near[1]) : undefined;
}

function extractSessionLocation(messages: ModelMessage[]): string | undefined {
  const currentTask = taskFromMessages(messages);
  const currentStated = extractStatedLocation(currentTask);
  if (currentStated) return currentStated;

  for (const message of messages.slice(0, -1).reverse().slice(0, 8)) {
    const text = messageContentToText(message.content);
    const explicit = text.match(/\b(?:location|current location|city|neighbou?rhood|nearby context)\s*[:=-]\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,4}(?:,?\s+[A-Z]{2})?)\b/i);
    if (explicit?.[1]) return cleanDisplayLocation(explicit[1]);
    const stated = extractStatedLocation(text);
    if (stated && /\b(?:location|near me|nearby|around me|closest|nearest|current location)\b/i.test(text)) {
      return stated;
    }
  }
  return undefined;
}

function decodeHtmlEntities(value: string): string {
  let decoded = value;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = decoded
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&#x([0-9a-f]+);?/gi, (_match, hex: string) => {
        const codePoint = Number.parseInt(hex, 16);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _match;
      })
      .replace(/&#(\d+);?/g, (_match, decimal: string) => {
        const codePoint = Number.parseInt(decimal, 10);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _match;
      })
      .replace(/&nbsp;/gi, ' ');
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function normalizeSearchResult(result: unknown, query: string): SearchWebResult {
  if (!isRecord(result)) {
    return { status: 'unavailable', query, reason: 'Search did not return a structured result.', results: [] };
  }
  const status = result.status === 'found' || result.status === 'empty' || result.status === 'unavailable'
    ? result.status
    : 'unavailable';
  const results = Array.isArray(result.results)
    ? result.results
      .map((item) => {
        if (!isRecord(item)) return null;
        const title = typeof item.title === 'string' ? decodeHtmlEntities(item.title).trim() : '';
        const url = typeof item.url === 'string' ? item.url.trim() : '';
        const snippet = typeof item.snippet === 'string' ? decodeHtmlEntities(item.snippet).trim() : '';
        return title && url ? { title, url, snippet } : null;
      })
      .filter((item): item is { title: string; url: string; snippet: string } => Boolean(item))
    : [];
  return {
    status: results.length > 0 && status === 'found' ? 'found' : status,
    query: typeof result.query === 'string' && result.query.trim() ? decodeHtmlEntities(result.query).trim() : query,
    results,
    ...(typeof result.reason === 'string' && result.reason.trim() ? { reason: decodeHtmlEntities(result.reason).trim() } : {}),
  };
}

async function fulfillSearchCandidates({
  searchResult,
  intent,
  location,
  allowedToolIds,
  runtime,
  bus,
  call,
}: {
  searchResult: SearchWebResult;
  intent: ExecutionIntent;
  location?: string;
  allowedToolIds: Set<string>;
  runtime: ToolAgentRuntime;
  bus?: IAgentBus;
  call: (toolId: string, args: unknown) => Promise<unknown>;
}): Promise<SearchCandidate[]> {
  const rejectedCandidates: RejectedSearchCandidate[] = [];
  const requiredCount = requiredAcceptedCandidateCount(intent);
  let candidates = extractSearchCandidates(searchResult.results, intent, location);
  let decision = analyzeSearchEvidence(searchResult, candidates, intent);
  let didReadPages = false;
  await appendSearchAnalysis(bus, decision, searchResult.query);

  if (
    searchResult.results.length > 0
    && isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.readPage)
  ) {
    const pageCandidates: SearchCandidate[] = [];
    const aggregateResults = searchResult.results.filter((result) => isAggregateResult(result.title, intent));
    const resultsToRead = (aggregateResults.length > 0 ? aggregateResults : searchResult.results)
      .slice(0, MAX_PAGES_TO_READ);
    for (const item of resultsToRead) {
      const pageResult = normalizeWebPageResult(await call(REQUIREMENT_TOOL_IDS.readPage, { url: item.url }), item.url);
      pageCandidates.push(...extractPageCandidates(pageResult, item, intent, location, rejectedCandidates));
    }
    didReadPages = true;
    candidates = mergeCandidates([...candidates, ...pageCandidates]);
    decision = analyzeSearchEvidence(searchResult, candidates, intent);
    await appendSearchAnalysis(bus, decision, 'page-read evidence');
  }

  const validationLimit = candidateLimitForIntent(intent);
  let prevalidated = finalizeValidatedCandidates(candidates, intent, location, rejectedCandidates, false, validationLimit);
  if (
    prevalidated.accepted.length === 0
    && !didReadPages
    && searchResult.results.length > 0
    && isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.readPage)
  ) {
    const pageCandidates: SearchCandidate[] = [];
    for (const item of searchResult.results.slice(0, MAX_PAGES_TO_READ)) {
      const pageResult = normalizeWebPageResult(await call(REQUIREMENT_TOOL_IDS.readPage, { url: item.url }), item.url);
      pageCandidates.push(...extractPageCandidates(pageResult, item, intent, location, rejectedCandidates));
    }
    candidates = mergeCandidates([...candidates, ...pageCandidates]);
    decision = analyzeSearchEvidence(searchResult, candidates, intent);
    await appendSearchAnalysis(bus, decision, 'page-read evidence');
    prevalidated = finalizeValidatedCandidates(candidates, intent, location, rejectedCandidates, false, validationLimit);
  }
  rememberRejectedCandidates(rejectedCandidates, prevalidated.rejected);
  const enrichedCandidates = await enrichSearchCandidates({
    candidates: prevalidated.accepted,
    intent,
    location,
    call,
  });
  let validated = finalizeValidatedCandidates(enrichedCandidates, intent, location, rejectedCandidates, true);
  if (validated.accepted.length < requiredCount && isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.search)) {
    const discoveryQuery = buildEntityDiscoveryQuery(intent, location);
    const discoveryResult = normalizeSearchResult(
      await call(REQUIREMENT_TOOL_IDS.search, { query: discoveryQuery, limit: MAX_DISCOVERY_SEARCH_RESULTS }),
      discoveryQuery,
    );
    const discoveryPageCandidates: SearchCandidate[] = [];
    if (
      discoveryResult.results.length > 0
      && isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.readPage)
    ) {
      const aggregateDiscoveryResults = discoveryResult.results.filter((result) => isAggregateResult(result.title, intent));
      const discoveryResultsToRead = (aggregateDiscoveryResults.length > 0 ? aggregateDiscoveryResults : discoveryResult.results)
        .slice(0, MAX_PAGES_TO_READ);
      for (const item of discoveryResultsToRead) {
        const pageResult = normalizeWebPageResult(await call(REQUIREMENT_TOOL_IDS.readPage, { url: item.url }), item.url);
        discoveryPageCandidates.push(...extractPageCandidates(pageResult, item, intent, location, rejectedCandidates));
      }
    }
    const discoveryCandidates = mergeCandidates([
      ...extractSearchCandidates(discoveryResult.results, intent, location),
      ...discoveryPageCandidates,
    ]);
    await appendSearchAnalysis(bus, {
      accepted: discoveryCandidates,
      rejected: discoveryResult.results.flatMap((result) => rejectedSnippetFragments(result, intent)).slice(0, 6),
      nextAction: discoveryCandidates.length > 0 ? 'answer' : 'blocked',
      rationale: discoveryCandidates.length > 0
        ? `Targeted discovery found ${discoveryCandidates.length} candidate ${intent.answerSubject} name(s).`
        : `Targeted discovery did not find source-backed ${intent.answerSubject} names.`,
    }, discoveryQuery);
    const prevalidatedDiscovery = finalizeValidatedCandidates(
      mergeCandidates([...enrichedCandidates, ...discoveryCandidates]),
      intent,
      location,
      rejectedCandidates,
      false,
      validationLimit,
    );
    rememberRejectedCandidates(rejectedCandidates, prevalidatedDiscovery.rejected);
    const enrichedDiscoveryCandidates = await enrichSearchCandidates({
      candidates: prevalidatedDiscovery.accepted,
      intent,
      location,
      call,
    });
    validated = finalizeValidatedCandidates(enrichedDiscoveryCandidates, intent, location, rejectedCandidates, true);
  }
  await appendValidatedCandidates(
    bus,
    validated.accepted,
    validated.rejected,
    searchResult.query,
    requiredCount,
    intent.validationContract,
  );
  return validated.accepted;
}

function analyzeSearchEvidence(
  searchResult: SearchWebResult,
  candidates: SearchCandidate[],
  intent: ExecutionIntent,
): SearchAnalysisDecision {
  const rejected = searchResult.results
    .flatMap((result) => rejectedSnippetFragments(result, intent))
    .slice(0, 6);
  const confident = candidates.filter((candidate) => candidate.confidence >= 0.55);
  if (searchResult.results.some((result) => isAggregateResult(result.title, intent))) {
    return {
      accepted: confident,
      rejected,
      nextAction: 'read-pages',
      rationale: confident.length > 0
        ? 'Search returned aggregate/listing pages with candidate names; read source pages before final candidate selection.'
        : 'Search returned aggregate/listing pages without reliable entity names; read source pages before selecting candidates.',
    };
  }
  if (confident.length > 0) {
    return {
      accepted: confident,
      rejected,
      nextAction: 'answer',
      rationale: `Accepted ${confident.length} validated ${intent.answerSubject} candidate(s).`,
    };
  }
  return {
    accepted: [],
    rejected,
    nextAction: 'blocked',
    rationale: `Search results did not contain validated ${intent.answerSubject} entities.`,
  };
}

function candidateLimitForIntent(intent: ExecutionIntent): number {
  return Math.max(MAX_CANDIDATES_TO_ENRICH, intent.requestedCount ?? 3);
}

function requiredAcceptedCandidateCount(intent: ExecutionIntent): number {
  return intent.requestedCount && intent.requestedCount > 0 ? intent.requestedCount : 1;
}

async function appendConversationContext(
  bus: IAgentBus | undefined,
  resolution: ConversationSearchResolution,
  intent: ExecutionIntent,
): Promise<void> {
  if (!bus || typeof bus.append !== 'function') return;
  if (!resolution.context && resolution.excludedCandidateNames.length === 0 && !resolution.inheritedLocation) return;
  await bus.append({
    type: PayloadType.InfOut,
    text: [
      `Conversation context resolved task: ${resolution.resolvedTaskText}.`,
      resolution.inheritedSubject ? `Inherited subject: ${resolution.inheritedSubject}.` : null,
      resolution.inheritedLocation ? `Inherited location: ${resolution.inheritedLocation}.` : null,
      resolution.excludedCandidateNames.length
        ? `Excluded prior candidates: ${resolution.excludedCandidateNames.join(', ')}.`
        : 'Excluded prior candidates: none.',
      `Current subject: ${intent.answerSubject}.`,
    ].filter(Boolean).join('\n'),
    meta: {
      actorId: 'conversation-context',
      actorRole: 'executor',
      parentActorId: 'execute-plan',
      branchId: 'agent:executor',
      agentLabel: 'Conversation Context',
      modelProvider: 'logact',
    },
  });
}

async function appendSearchAnalysis(
  bus: IAgentBus | undefined,
  decision: SearchAnalysisDecision,
  source: string,
): Promise<void> {
  if (!bus || typeof bus.append !== 'function') return;
  await bus.append({
    type: PayloadType.InfOut,
    text: [
      `Search analyzer reviewed ${source}.`,
      `Decision: ${decision.nextAction}.`,
      `Rationale: ${decision.rationale}`,
      decision.accepted.length ? `Accepted: ${decision.accepted.map((candidate) => candidate.name).join(', ')}` : 'Accepted: none',
      decision.rejected.length ? `Rejected fragments: ${decision.rejected.join('; ')}` : 'Rejected fragments: none',
    ].join('\n'),
    meta: {
      actorId: 'search-analyzer',
      actorRole: 'executor',
      parentActorId: 'execute-plan',
      branchId: 'agent:executor',
      agentLabel: 'Search Analyzer',
      modelProvider: 'logact',
    },
  });
}

async function appendSearchFanIn(
  bus: IAgentBus | undefined,
  webResult: SearchWebResult,
  localResearch: WebResearchRunResult | undefined,
  mergedResult: SearchWebResult,
): Promise<void> {
  if (!bus || typeof bus.append !== 'function') return;
  const localResultCount = localResearch?.evidence.length ?? 0;
  const localErrorText = localResearch?.errors.length
    ? ` Local research errors: ${localResearch.errors.map((error) => error.message).join('; ')}.`
    : '';
  const activeBranches = [
    'web search',
    localResearch ? 'local web research' : null,
  ].filter((branch): branch is string => Boolean(branch));
  const fanInSummaryLines = [
    activeBranches.length > 1
      ? `Fan-in merge combined ${formatJoinedList(activeBranches)} evidence before candidate reranking.`
      : 'Fan-in merge used web search evidence before candidate reranking.',
  ];
  await bus.append({
    type: PayloadType.InfOut,
    text: [
      ...fanInSummaryLines,
      `Web search status: ${webResult.status}; web results: ${webResult.results.length}.`,
      `Local web research evidence chunks: ${localResultCount}; local search results: ${localResearch?.searchResults.length ?? 0}.${localErrorText}`,
      `Merged results: ${mergedResult.results.length}.`,
    ].join('\n'),
    meta: {
      actorId: 'search-fan-in-merger',
      actorRole: 'executor',
      parentActorId: 'execute-plan',
      branchId: 'agent:search-fan-in-merger',
      agentLabel: 'Search Fan-In Merger',
      modelProvider: 'logact',
    },
  });
}

function normalizeWebPageResult(result: unknown, url: string): ReadWebPageResult {
  if (!isRecord(result)) {
    return { status: 'unavailable', url, links: [], jsonLd: [], entities: [], observations: [], reason: 'Page read did not return a structured result.' };
  }
  const status = result.status === 'read' || result.status === 'unavailable' || result.status === 'blocked'
    ? result.status
    : 'unavailable';
  return {
    status,
    url: typeof result.url === 'string' && result.url.trim() ? result.url.trim() : url,
    ...(typeof result.title === 'string' && result.title.trim() ? { title: decodeHtmlEntities(result.title).trim() } : {}),
    ...(typeof result.text === 'string' && result.text.trim() ? { text: decodeHtmlEntities(result.text).trim() } : {}),
    links: Array.isArray(result.links)
      ? result.links
        .map((link) => {
          if (!isRecord(link)) return null;
          const text = typeof link.text === 'string' ? decodeHtmlEntities(link.text).trim() : '';
          const linkUrl = typeof link.url === 'string' ? link.url.trim() : '';
          return text && linkUrl ? { text, url: linkUrl } : null;
        })
        .filter((link): link is { text: string; url: string } => Boolean(link))
      : [],
    jsonLd: Array.isArray(result.jsonLd) ? [...result.jsonLd] : [],
    entities: Array.isArray(result.entities)
      ? result.entities
        .map((entity) => {
          if (!isRecord(entity)) return null;
          const name = typeof entity.name === 'string' ? decodeHtmlEntities(entity.name).trim() : '';
          const entityUrl = typeof entity.url === 'string' && entity.url.trim() ? entity.url.trim() : undefined;
          const evidence = typeof entity.evidence === 'string' && entity.evidence.trim() ? decodeHtmlEntities(entity.evidence).trim() : 'page evidence';
          return name ? { name, ...(entityUrl ? { url: entityUrl } : {}), evidence } : null;
        })
        .filter((entity): entity is { name: string; url?: string; evidence: string } => Boolean(entity))
      : [],
    observations: Array.isArray(result.observations)
      ? result.observations
        .map((observation) => {
          if (!isRecord(observation)) return null;
          const kind = observation.kind === 'json-ld'
            || observation.kind === 'page-link'
            || observation.kind === 'heading'
            || observation.kind === 'text-span'
            ? observation.kind
            : undefined;
          const label = typeof observation.label === 'string' ? decodeHtmlEntities(observation.label).trim() : '';
          const observationUrl = typeof observation.url === 'string' && observation.url.trim()
            ? observation.url.trim()
            : undefined;
          const evidence = typeof observation.evidence === 'string' && observation.evidence.trim()
            ? decodeHtmlEntities(observation.evidence).trim()
            : 'page observation';
          const localContext = typeof observation.localContext === 'string' && observation.localContext.trim()
            ? decodeHtmlEntities(observation.localContext).trim()
            : undefined;
          const sourceUrl = typeof observation.sourceUrl === 'string' && observation.sourceUrl.trim()
            ? observation.sourceUrl.trim()
            : url;
          return kind && label ? {
            kind,
            label,
            ...(observationUrl ? { url: observationUrl } : {}),
            evidence,
            ...(localContext ? { localContext } : {}),
            sourceUrl,
          } : null;
        })
        .filter((observation): observation is ReadWebPageResult['observations'][number] => Boolean(observation))
      : [],
    ...(typeof result.reason === 'string' && result.reason.trim() ? { reason: decodeHtmlEntities(result.reason).trim() } : {}),
  };
}

function createSearchCandidate({
  rawName,
  url,
  snippet,
  rank,
  sourceOrder,
  sourceQuality,
  needsLinkEnrichment,
  sourceName,
  reason,
  confidence,
  evidenceKind,
  intent,
  location,
  evidenceContext,
  rejectedCandidates,
}: {
  rawName: string;
  url: string;
  snippet: string;
  rank: number;
  sourceOrder: number;
  sourceQuality: number;
  needsLinkEnrichment: boolean;
  sourceName: string;
  reason: string;
  confidence: number;
  evidenceKind: SearchCandidate['evidenceKind'];
  intent: ExecutionIntent;
  location?: string;
  evidenceContext: string[];
  rejectedCandidates?: RejectedSearchCandidate[];
}): SearchCandidate | null {
  const name = cleanCandidateName(rawName, intent);
  if (!name) {
    const rejectedName = rejectedCandidateDisplayName(rawName);
    if (rejectedName) {
      rejectedCandidates?.push({
        name: rejectedName,
        validationStatus: 'rejected',
        validationFailures: ['candidate label is a generic page, navigation, category, or content label'],
        evidence: compactEvidence(evidenceContext).slice(0, 4),
      });
    }
    return null;
  }
  const validation = validateCandidateEvidence(name, url, intent, location, evidenceContext, evidenceKind);
  const validationEvidence = compactEvidence(evidenceContext);
  if (validation.validationFailures.length > 0) {
    rejectedCandidates?.push({
      name,
      validationStatus: 'rejected',
      validationFailures: validation.validationFailures,
      evidence: validationEvidence.slice(0, 4),
    });
    return null;
  }
  return {
    name,
    url,
    snippet,
    rank,
    sourceOrder,
    sourceQuality,
    needsLinkEnrichment,
    mentions: 1,
    sources: [sourceName],
    reasons: [reason],
    validationEvidence,
    confidence,
    evidenceKind,
    validationStatus: 'accepted',
    subjectMatch: true,
    entityLink: url,
    sourceEvidence: validation.sourceEvidence.length > 0 ? validation.sourceEvidence : validation.subjectEvidence,
    subjectEvidence: validation.subjectEvidence,
    locationEvidence: validation.locationEvidence,
    linkEvidence: validation.linkEvidence,
    validationFailures: [],
  };
}

function rejectedCandidateDisplayName(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/^\s*\d+[\).:]?\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 96);
}

function validateCandidateEvidence(
  name: string,
  url: string,
  intent: ExecutionIntent,
  location: string | undefined,
  evidenceContext: string[],
  evidenceKind?: SearchCandidate['evidenceKind'],
): CandidateValidation {
  const failures: string[] = [];
  const requiresLocalCandidateEvidence = evidenceKind === 'page-entity'
    || evidenceKind === 'page-link'
    || evidenceKind === 'page-text-list';
  const subjectEvidence = collectSubjectEvidence(intent, evidenceContext, name, requiresLocalCandidateEvidence);
  const locationEvidence = collectLocationEvidence(location, evidenceContext, name, requiresLocalCandidateEvidence);
  const linkEvidence = classifyLinkEvidence(url, name, evidenceContext);
  const sourceEvidence = collectSourceBackedEntityEvidence(
    intent,
    evidenceContext,
    name,
    location,
    requiresLocalCandidateEvidence,
  );
  if (isForbiddenEntityLabel(name, intent)) {
    failures.push('candidate label is a generic page, navigation, category, or content label');
  }
  if (isLocationOrAddressOnlyCandidate(name, location, evidenceContext)) {
    failures.push('candidate label is a location/address component, not a named requested entity');
  }
  if (linkEvidence === 'invalid') {
    failures.push('candidate link is invalid');
  }
  if (subjectEvidence.length === 0) {
    failures.push('candidate lacks subject-compatible evidence');
  }
  if (location && locationEvidence.length === 0) {
    failures.push('candidate lacks geographic evidence');
  }
  if (requiresCandidateInstanceEvidence(evidenceKind) && sourceEvidence.length === 0) {
    failures.push('candidate lacks source-backed entity-instance evidence');
  }
  return {
    validationFailures: failures,
    subjectEvidence,
    locationEvidence,
    linkEvidence,
    sourceEvidence,
  };
}

export function isGenericNonEntityLabel(label: string, subject?: string): boolean {
  const normalized = label.replace(/^['"]|['"]$/g, '').replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  return FORBIDDEN_ENTITY_LABEL_PATTERN.test(normalized)
    || FORBIDDEN_ENTITY_LABEL_WORD_PATTERN.test(normalized)
    || SITE_SECTION_LABEL_PATTERN.test(normalized)
    || isMovieTimeDirectoryLabel(normalized)
    || isTechnicalPageArtifactLabel(normalized)
    || isContentNavigationArtifactLabel(normalized)
    || (subject ? isGenericSubjectCategoryLabel(normalized, subject) : false)
    || (subject ? isGenericSubjectSectionLabel(normalized, subject) : false)
    || (subject ? isSubjectIncompatibleSiteSectionLabel(normalized, subject) : false);
}

function isMovieTimeDirectoryLabel(label: string): boolean {
  const normalized = label.replace(/^['"]|['"]$/g, '').replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  return MOVIE_TIME_DIRECTORY_LABEL_PATTERN.test(normalized)
    || /\b(?:movie\s+times?|movies?)\s+by\s+(?:cities|city|states?|zip(?:\s+codes?)?)\b/i.test(normalized)
    || /\b(?:cities|city|states?|zip(?:\s+codes?)?)\s+movie\s+times?\b/i.test(normalized);
}

function isForbiddenEntityLabel(name: string, intent?: ExecutionIntent): boolean {
  const normalized = name.replace(/^['"]|['"]$/g, '').trim();
  return isGenericNonEntityLabel(normalized, intent?.answerSubject)
    || (intent ? isAggregateSourceTitleLabel(normalized, intent) : false);
}

function isTechnicalPageArtifactLabel(label: string): boolean {
  const normalized = label.replace(/^['"]|['"]$/g, '').replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  return TECHNICAL_ARTIFACT_LABEL_PATTERN.test(normalized)
    || TECHNICAL_ARTIFACT_WORD_PATTERN.test(normalized);
}

function isTechnicalPageArtifactEvidence(value: string): boolean {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  if (TECHNICAL_ARTIFACT_WORD_PATTERN.test(normalized)) return true;
  if (/\b(?:ad|ads|adunit|adunits|banner|logo)\b/i.test(normalized) && /["'{[\]}:=]/.test(normalized)) return true;
  if (/\b(?:font|font-family|serif|sans-serif|line-height|stylesheet|css)\b/i.test(normalized) && /["'{[\]}:;]/.test(normalized)) return true;
  if (/\b(?:window|document|function|var|let|const)\b/i.test(normalized) && /[{}=;]/.test(normalized)) return true;
  return false;
}

function isContentNavigationArtifactLabel(label: string): boolean {
  const normalized = label.replace(/^['"]|['"]$/g, '').replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  if (CONTENT_NAVIGATION_ARTIFACT_WORD_PATTERN.test(normalized)) return true;
  const tokens = tokenSet(normalized);
  const contentTokens = new Set([
    'movie',
    'movies',
    'video',
    'videos',
    'trailer',
    'trailers',
    'streaming',
    'showime',
    'showimes',
    'showtime',
    'showtimes',
    'ticket',
    'tickets',
    'ticketing',
    'featured',
    'watch',
    'charts',
    'news',
    'offer',
    'offers',
    'promo',
    'promos',
    'fanclub',
  ]);
  const tokenHits = [...tokens].filter((token) => contentTokens.has(token)).length;
  if (tokenHits >= 2) return true;
  return /\b(?:my|account|join)\b/i.test(normalized) && tokenHits >= 1;
}

function isContentNavigationArtifactEvidence(value: string): boolean {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  if (CONTENT_NAVIGATION_ARTIFACT_WORD_PATTERN.test(normalized)) return true;
  if (/\b(?:displayed|appears?|shown|linked)\s+(?:in|on)\s+(?:the\s+)?(?:content|featured|trending|watch|ticketing|showt?imes?|movies?|videos?|promo|offer|site)\s+(?:area|bucket|section|rail|module|carousel|strip|page)\b/i.test(normalized)) {
    return true;
  }
  const contentWordCount = (normalized.match(/\b(?:movies?|trailers?|teasers?|videos?|streaming|coming\s+soon|showt?imes?|ticketing|tickets?|featured|watch|charts?|news|offers?|promos?)\b/gi) ?? []).length;
  return contentWordCount >= 4;
}

function isLocationOrAddressOnlyCandidate(
  name: string,
  location: string | undefined,
  evidenceContext: string[],
): boolean {
  const normalizedName = name.replace(/\s+/g, ' ').trim();
  if (!normalizedName) return true;
  if (/^(?:[A-Z]{2}\s*)?\d{5}(?:-\d{4})?$/i.test(normalizedName)) return true;
  if (/^[A-Z]{2}\s+\d{5}(?:-\d{4})?$/i.test(normalizedName)) return true;
  if (/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i.test(normalizedName) && /\b(?:update|zip(?:code)?|postal|date|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(normalizedName)) {
    return true;
  }
  if (/^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}$/i.test(normalizedName)) {
    return true;
  }

  const nameTokens = tokenSet(normalizedName);
  if (location && nameTokens.size > 0) {
    const locationTokens = tokenSet(location);
    if ([...nameTokens].every((token) => locationTokens.has(token))) return true;
  }

  const namePattern = escapedFlexiblePhrase(normalizedName);
  const addressFieldBeforeName = new RegExp(
    `\\b(?:addressLocality|addressRegion|addressCountry|postalCode|streetAddress)\\b[^\\n]{0,180}${namePattern}`,
    'i',
  );
  const addressFieldAfterName = new RegExp(
    `${namePattern}[^\\n]{0,180}\\b(?:addressLocality|addressRegion|addressCountry|postalCode|streetAddress)\\b`,
    'i',
  );
  return evidenceContext.some((item) => (
    addressFieldBeforeName.test(item)
    || addressFieldAfterName.test(item)
  ));
}

function escapedFlexiblePhrase(value: string): string {
  return escapeRegExp(value).replace(/\\\s\+/g, '\\s+').replace(/\s+/g, '\\s+');
}

function requiresCandidateInstanceEvidence(evidenceKind?: SearchCandidate['evidenceKind']): boolean {
  return evidenceKind === undefined
    || evidenceKind === 'page-entity'
    || evidenceKind === 'page-link'
    || evidenceKind === 'page-text-list';
}

function collectSourceBackedEntityEvidence(
  intent: ExecutionIntent,
  evidenceContext: string[],
  name: string,
  location?: string,
  requireCandidateSpecificSubjectAndLocation = false,
): string[] {
  const subjectTokens = expandedTokenSet(intent.answerSubject);
  const locationTokens = location ? expandedTokenSet(location) : new Set<string>();
  const context = compactEvidence(evidenceContext);
  const contextHasSubject = context.some((item) => overlapScore(expandedTokenSet(item), subjectTokens) > 0);
  const contextHasLocation = locationTokens.size === 0
    || context.some((item) => overlapScore(expandedTokenSet(item), locationTokens) > 0);
  return candidateSpecificEvidence(evidenceContext, name)
    .filter((item) => !isWeakCandidateObservation(item, name))
    .filter((item) => (
      overlapScore(expandedTokenSet(item), subjectTokens) > 0
      || (!requireCandidateSpecificSubjectAndLocation && contextHasSubject)
    ))
    .filter((item) => (
      locationTokens.size === 0
      || overlapScore(expandedTokenSet(item), locationTokens) > 0
      || (!requireCandidateSpecificSubjectAndLocation && contextHasLocation)
      || (!requireCandidateSpecificSubjectAndLocation && /\b(?:near|nearby|local|around|in|at|within|miles?|minutes?|address|located)\b/i.test(item))
    ))
    .slice(0, 3);
}

function isWeakCandidateObservation(value: string, name: string): boolean {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  if (normalized.toLocaleLowerCase() === name.toLocaleLowerCase()) return true;
  if (/\bappears?\s+in\s+a\s+source\s+section\s+for\b/i.test(normalized)) return true;
  if (/^(?:page link|page text|source page|source result|page evidence|page navigation link|account action link|site community section link|page content bucket link|page store section link)$/i.test(normalized)) {
    return true;
  }
  if (isMetadataOrPublisherEvidence(normalized)) {
    return true;
  }
  const prefixPublisherPattern = new RegExp(
    `^${escapedFlexiblePhrase(name)}\\s*[:|-]\\s*[^.!?]{0,160}\\b(?:best|top|guide|spots?|near|nearby|list|listing|directory|source)\\b`,
    'i',
  );
  if (prefixPublisherPattern.test(normalized)) {
    return true;
  }
  if (/\b(?:global\s+navigation|site\s+navigation|page\s+navigation|navigation\s+link|account\s+(?:menu|action)|community\s+navigation|community\s+section|content\s+bucket|store\s+section|header|footer|menu|sign\s*in|login|fan\s*club)\b/i.test(normalized)) {
    return true;
  }
  if (/\b(?:displayed|appears?|shown|linked)\s+(?:in|on)\s+(?:the\s+)?(?:global\s+)?(?:navigation|menu|header|footer|account|community|site)\b/i.test(normalized)) {
    return true;
  }
  if (isContentNavigationArtifactLabel(name) || isContentNavigationArtifactEvidence(normalized)) return true;
  if (isTechnicalPageArtifactLabel(name) || isTechnicalPageArtifactEvidence(normalized)) return true;
  if (isGeographicListObservation(normalized, name)) return true;
  if (/^https?:\/\//i.test(normalized)) return true;
  return false;
}

function isMetadataOrPublisherEvidence(value: string): boolean {
  if (/[{}[\]":]/.test(value) && /\b(?:@context|@type|schema\.org|article|headline|author|publisher|datePublished|dateModified|description|image)\b/i.test(value)) {
    return true;
  }
  if (/\b(?:article|publisher|author|published|updated|headline|site owner|site name)\b/i.test(value)
    && /\b(?:guide|post|story|page|source|directory|listing)\b/i.test(value)) {
    return true;
  }
  return false;
}

function isGeographicListObservation(value: string, name: string): boolean {
  const namePattern = escapedFlexiblePhrase(name);
  const geographicListPattern = new RegExp(
    `\\b(?:areas?|regions?|cities|towns?|villages?|neighbou?rhoods?|communities|locations)\\b[^.!?]{0,180}\\b(?:include|includes|including|such as|around|near)\\b[^.!?]{0,180}${namePattern}`,
    'i',
  );
  const afterIncludingPattern = new RegExp(
    `\\b(?:include|includes|including|such as)\\b[^.!?]{0,180}${namePattern}[^.!?]{0,180}\\b(?:areas?|regions?|cities|towns?|villages?|neighbou?rhoods?|communities|locations)\\b`,
    'i',
  );
  return geographicListPattern.test(value) || afterIncludingPattern.test(value);
}

function collectSubjectEvidence(
  intent: ExecutionIntent,
  evidenceContext: string[],
  name?: string,
  requireCandidateSpecificSubject = false,
): string[] {
  const subjectTokens = expandedTokenSet(intent.answerSubject);
  const contextHasSubject = compactEvidence(evidenceContext)
    .some((item) => overlapScore(expandedTokenSet(item), subjectTokens) > 0);
  const specific = candidateSpecificEvidence(evidenceContext, name)
    .filter((item) => !name || !isWeakCandidateObservation(item, name))
    .filter((item) => overlapScore(expandedTokenSet(item), subjectTokens) > 0);
  if (requireCandidateSpecificSubject) return specific.slice(0, 3);
  return specific
    .concat(contextHasSubject
      ? candidateSpecificEvidence(evidenceContext, name)
        .filter((item) => !name || !isWeakCandidateObservation(item, name))
        .slice(0, 1)
      : [])
    .slice(0, 3);
}

function collectLocationEvidence(
  location: string | undefined,
  evidenceContext: string[],
  name?: string,
  requireCandidateSpecificLocation = false,
): string[] {
  if (!location) return [];
  const locationTokens = expandedTokenSet(location);
  const specificEvidence = candidateSpecificEvidence(evidenceContext, name)
    .filter((item) => !name || !isWeakCandidateObservation(item, name));
  const directEvidence = specificEvidence
    .filter((item) => overlapScore(expandedTokenSet(item), locationTokens) > 0)
    .slice(0, 3);
  if (directEvidence.length > 0) return directEvidence;
  if (requireCandidateSpecificLocation) return [];
  const contextLocationEvidence = compactEvidence(evidenceContext)
    .filter((item) => overlapScore(expandedTokenSet(item), locationTokens) > 0)
    .slice(0, 2);
  if (specificEvidence.length > 0 && contextLocationEvidence.length > 0) {
    return uniqueStrings([...specificEvidence.slice(0, 1), ...contextLocationEvidence]).slice(0, 3);
  }
  if (
    name
    && specificEvidence.some((item) => /\b(?:near|nearby|local|around|in|at|within|miles?|minutes?)\b/i.test(item))
  ) {
    return compactEvidence(evidenceContext)
      .filter((item) => !segmentMentionsCandidate(item, name))
      .filter((item) => overlapScore(expandedTokenSet(item), locationTokens) > 0)
      .slice(0, 2);
  }
  return [];
}

function candidateSpecificEvidence(evidenceContext: string[], name?: string): string[] {
  const compact = compactEvidence(evidenceContext);
  if (!name) return compact;
  const candidateSegments = compact.flatMap((item) => splitEvidenceSegments(item)
    .filter((segment) => segmentMentionsCandidate(segment, name)));
  return uniqueStrings(candidateSegments);
}

function splitEvidenceSegments(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+|[;\n]+/)
    .map((segment) => segment.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function segmentMentionsCandidate(segment: string, name: string): boolean {
  const normalizedSegment = segment.toLocaleLowerCase();
  const normalizedName = name.toLocaleLowerCase();
  if (normalizedSegment.includes(normalizedName)) return true;
  const nameTokens = expandedTokenSet(name);
  return nameTokens.size >= 2 && overlapScore(expandedTokenSet(segment), nameTokens) >= Math.min(2, nameTokens.size);
}

function compactEvidence(values: string[]): string[] {
  return uniqueStrings(values
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function classifyLinkEvidence(
  url: string,
  name: string,
  evidenceContext: string[],
): SearchCandidate['linkEvidence'] {
  if (!url || /^#|^javascript:|^mailto:/i.test(url)) return 'invalid';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'invalid';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'invalid';
  if (/^www\.wikidata\.org$/i.test(parsed.hostname) && /^\/(?:wiki|entity)\/Q[1-9][0-9]*$/i.test(parsed.pathname)) {
    return 'entity-specific';
  }
  const compactName = compactEntityKey(name);
  const directLinkEvidence = evidenceContext
    .filter((item) => /^Entity-specific source result:/i.test(item));
  const linkHaystack = `${parsed.hostname} ${parsed.pathname} ${directLinkEvidence.join(' ')}`;
  const compactLinkHaystack = compactEntityKey(linkHaystack);
  if (compactName.length >= 6 && compactLinkHaystack.includes(compactName)) return 'entity-specific';
  const distinctiveTokens = distinctiveLinkTokens(name);
  const haystackTokens = tokenSet(linkHaystack);
  const compactDistinctiveTokenPairs = adjacentTokenPhrases(distinctiveTokens)
    .map(compactEntityKey)
    .filter((token) => token.length >= 6);
  if (compactDistinctiveTokenPairs.some((token) => compactLinkHaystack.includes(token))) {
    return 'entity-specific';
  }
  const compactDistinctiveMatches = distinctiveTokens
    .filter((token) => token.length >= 4)
    .filter((token) => compactLinkHaystack.includes(compactEntityKey(token)));
  if (compactDistinctiveMatches.length >= 2) return 'entity-specific';
  if (distinctiveTokens.length >= 2 && distinctiveTokens.filter((token) => haystackTokens.has(token)).length >= 2) {
    return 'entity-specific';
  }
  if (
    distinctiveTokens.length === 1
    && !isReferenceUrl(parsed)
    && tokenSet(`${parsed.hostname} ${parsed.pathname}`).has(distinctiveTokens[0])
  ) {
    return 'entity-specific';
  }
  return 'unknown';
}

function adjacentTokenPhrases(tokens: string[]): string[] {
  const phrases: string[] = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    phrases.push(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return phrases;
}

function distinctiveLinkTokens(name: string): string[] {
  const generic = new Set([
    'bar',
    'bars',
    'cafe',
    'cafes',
    'coffee',
    'restaurant',
    'restaurants',
    'dining',
    'eatery',
    'eateries',
    'park',
    'parks',
    'theater',
    'theaters',
    'theatre',
    'theatres',
    'cinema',
    'cinemas',
    'movie',
    'movies',
    'museum',
    'museums',
    'gym',
    'gyms',
    'fitness',
    'bookstore',
    'bookstores',
    'books',
    'shop',
    'shops',
    'venue',
    'venues',
    'music',
  ]);
  return [...tokenSet(name)]
    .filter((token) => !generic.has(token))
    .filter((token) => token.length > 2);
}

function isReferenceUrl(url: URL): boolean {
  return /\b(?:dictionary|definition|meaning|thesaurus|wikipedia|wiktionary|encyclopedia)\b/i.test(`${url.hostname} ${url.pathname}`);
}

function extractPageCandidates(
  pageResult: ReadWebPageResult,
  sourceResult: SearchWebItem,
  intent: ExecutionIntent,
  location?: string,
  rejectedCandidates?: RejectedSearchCandidate[],
): SearchCandidate[] {
  if (pageResult.status !== 'read') return [];
  const sourceName = sourceNameFromTitle(sourceResult.title);
  const candidates: SearchCandidate[] = [];
  for (const entity of pageResult.entities) {
    const candidate = createSearchCandidate({
      rawName: entity.name,
      url: entity.url ?? pageResult.url,
      snippet: entity.evidence,
      rank: candidates.length + 1,
      sourceOrder: sourceResultIndex(sourceResult, entity.name),
      sourceQuality: 0,
      needsLinkEnrichment: !entity.url,
      sourceName,
      reason: `Found on ${sourceName} source page${location ? ` for ${cleanDisplayLocation(location)}` : ''}.`,
      confidence: 0.9,
      evidenceKind: 'page-entity',
      intent,
      location,
      evidenceContext: [
        entity.evidence,
        ...candidateTextSegments(pageResult.text, entity.name),
        pageResult.title ?? '',
        sourceResult.title,
        sourceResult.snippet,
        entity.url ?? pageResult.url,
      ],
      rejectedCandidates,
    });
    if (candidate) candidates.push(candidate);
  }
  for (const link of pageResult.observations.filter((observation) => observation.kind === 'page-link' && observation.localContext)) {
    const candidate = createSearchCandidate({
      rawName: link.label,
      url: link.url ?? pageResult.url,
      snippet: link.localContext ?? link.evidence,
      rank: candidates.length + 1,
      sourceOrder: 0,
      sourceQuality: 1,
      needsLinkEnrichment: false,
      sourceName,
      reason: `Linked by ${sourceName} source page.`,
      confidence: 0.75,
      evidenceKind: 'page-link',
      intent,
      location,
      evidenceContext: [
        link.label,
        link.evidence,
        link.localContext ?? '',
        link.url ?? '',
      ],
      rejectedCandidates,
    });
    if (candidate) candidates.push(candidate);
  }
  candidates.push(...extractPageTextListCandidates(pageResult, sourceResult, intent, location, sourceName, rejectedCandidates));
  return mergeCandidates(candidates);
}

function candidateTextSegments(text: string | undefined, name: string): string[] {
  if (!text) return [];
  return splitEvidenceSegments(text)
    .filter((segment) => segmentMentionsCandidate(segment, name))
    .filter((segment) => !isWeakCandidateObservation(segment, name))
    .slice(0, 3);
}

function extractPageTextListCandidates(
  pageResult: ReadWebPageResult,
  sourceResult: SearchWebItem,
  intent: ExecutionIntent,
  location: string | undefined,
  sourceName: string,
  rejectedCandidates?: RejectedSearchCandidate[],
): SearchCandidate[] {
  const sections = extractSubjectEntityListSections(pageResult.text, intent, location);
  const candidates: SearchCandidate[] = [];
  for (const section of sections) {
    const names = extractNamesFromSubjectEntityList(section, intent).slice(0, MAX_CANDIDATES_TO_ENRICH);
    for (const [index, name] of names.entries()) {
      const evidence = textListEvidence(section, name, intent, location, sourceResult);
      const candidate = createSearchCandidate({
        rawName: name,
        url: pageResult.url,
        snippet: evidence,
        rank: candidates.length + index + 1,
        sourceOrder: 0,
        sourceQuality: 1,
        needsLinkEnrichment: true,
        sourceName,
        reason: `Listed in a ${sourceName} source page section for ${intent.answerSubject}${location ? ` near ${cleanDisplayLocation(location)}` : ''}.`,
        confidence: 0.74,
        evidenceKind: 'page-text-list',
        intent,
        location,
        evidenceContext: [
          evidence,
          section,
          pageResult.title ?? '',
          sourceResult.title,
          sourceResult.snippet,
          pageResult.url,
        ],
        rejectedCandidates,
      });
      if (candidate) candidates.push(candidate);
    }
  }
  return candidates;
}

function extractSubjectEntityListSections(
  text: string | undefined,
  intent: ExecutionIntent,
  _location?: string,
): string[] {
  if (!text) return [];
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const subjectPattern = subjectTermPattern(intent);
  const listLead = new RegExp(
    `\\b(?:nearby|local|recommended|top|best|popular)?\\s*(?:${subjectPattern})\\b\\s*:?\\s*(?:select\\s+(?:${subjectPattern})\\b\\s*)?`,
    'gi',
  );
  const sections: string[] = [];
  for (const match of normalized.matchAll(listLead)) {
    const index = match.index ?? 0;
    const lead = match[0];
    if (!/\b(?:nearby|local|recommended|top|best|popular|select)\b/i.test(lead)) continue;
    const tail = normalized.slice(index, index + 1400);
    const boundaryIndex = firstBoundaryIndex(tail);
    const section = tail.slice(0, boundaryIndex > 120 ? boundaryIndex : Math.min(tail.length, 900)).trim();
    if (!section || section.length < 40) continue;
    sections.push(section);
  }
  return uniqueStrings(sections).slice(0, 3);
}

function subjectTermPattern(intent: ExecutionIntent): string {
  const terms = uniqueStrings([
    intent.answerSubject,
    ...[...expandedTokenSet(intent.answerSubject)],
  ])
    .map((term) => term.trim())
    .filter((term) => term.length > 2)
    .sort((left, right) => right.length - left.length)
    .map((term) => escapeRegExp(term).replace(/\\\s+/g, '\\s+'));
  return terms.length > 0 ? `(?:${terms.join('|')})` : '(?:entities|places|venues)';
}

function firstBoundaryIndex(section: string): number {
  const boundaries = [
    /\b(?:movie|show|event|menu|hours?|times?)\s+by\s+(?:cities|states|zip|theaters|venues|locations)\b/i,
    /\b(?:theater|theatre|venue|restaurant|park|cafe|bar|place|location)\s+chain\b/i,
    /\b(?:amenities|details|filters?|sort|cancel|reset|close|new\s+&?\s+coming\s+soon|experience\s+\+?\s+explore|featured|offers?)\b/i,
  ];
  const matches = boundaries
    .map((pattern) => section.search(pattern))
    .filter((index) => index > 80);
  return matches.length > 0 ? Math.min(...matches) : section.length;
}

function extractNamesFromSubjectEntityList(section: string, intent: ExecutionIntent): string[] {
  const listText = stripSubjectEntityListLead(section, intent);
  const names = [
    ...extractNumberTerminatedNames(listText, intent),
    ...extractSuffixTerminatedNames(listText, intent),
  ];
  return uniqueStrings(names)
    .map((name) => cleanCandidateName(name, intent))
    .filter(Boolean)
    .filter((name) => !isGenericNonEntityLabel(name, intent.answerSubject));
}

function stripSubjectEntityListLead(section: string, intent: ExecutionIntent): string {
  const subjectPattern = subjectTermPattern(intent);
  return section
    .replace(new RegExp(`^.*?\\bselect\\s+(?:${subjectPattern})\\b\\s*`, 'i'), '')
    .replace(new RegExp(`^.*?\\b(?:nearby|local|recommended|top|best|popular)\\s+(?:${subjectPattern})\\b\\s*:?\\s*`, 'i'), '')
    .trim();
}

function extractNumberTerminatedNames(value: string, intent: ExecutionIntent): string[] {
  return [...value.matchAll(/\b([A-Z][A-Za-z0-9&'.-]+(?:\s+(?:[A-Z0-9][A-Za-z0-9&'.-]+|Of|At|The|And|In)){0,5}?\s+\d{1,3})\b/g)]
    .map((match) => match[1])
    .filter((name) => candidateListNameHasEnoughEvidence(name, value, intent));
}

function extractSuffixTerminatedNames(value: string, intent: ExecutionIntent): string[] {
  const suffixPattern = genericEntitySuffixPattern(intent);
  const pattern = new RegExp(
    `\\b([A-Z][A-Za-z0-9&'.-]+(?:\\s+(?:[A-Z0-9][A-Za-z0-9&'.-]+|Of|At|The|And|In)){0,6}?\\s+(?:${suffixPattern})(?:\\s+[A-Z0-9][A-Za-z0-9&'.-]+){0,2})\\b`,
    'g',
  );
  return [...value.matchAll(pattern)]
    .map((match) => match[1])
    .filter((name) => candidateListNameHasEnoughEvidence(name, value, intent));
}

function genericEntitySuffixPattern(intent: ExecutionIntent): string {
  const suffixes = new Set([
    'Theatre',
    'Theater',
    'Cinema',
    'Cinemas',
    'Restaurant',
    'Restaurants',
    'Bar',
    'Cafe',
    'Coffee',
    'Park',
    'Parks',
    'Shop',
    'Shops',
    'Store',
    'Market',
    'Grill',
    'Kitchen',
    'Bistro',
    'Tavern',
    'Club',
    'Lounge',
    'Hotel',
    'Museum',
    'Center',
    'Centre',
    'Stadium',
    'Arena',
    'Gym',
    'Fitness',
    'Bookstore',
    'Books',
    'Venue',
    'Venues',
  ]);
  for (const term of expandedTokenSet(intent.answerSubject)) {
    if (term.length > 3) {
      suffixes.add(capitalizeToken(term));
      if (!term.endsWith('s')) suffixes.add(capitalizeToken(`${term}s`));
    }
  }
  return [...suffixes].map(escapeRegExp).join('|');
}

function candidateListNameHasEnoughEvidence(name: string, section: string, intent: ExecutionIntent): boolean {
  if (!name || isForbiddenEntityLabel(name, intent)) return false;
  const nameTokens = tokenSet(name);
  if (nameTokens.size < 2) return false;
  const context = surroundingText(section, name, 180);
  const sectionLead = section.slice(0, 260);
  return overlapScore(expandedTokenSet(context), expandedTokenSet(intent.answerSubject)) > 0
    || overlapScore(expandedTokenSet(sectionLead), expandedTokenSet(intent.answerSubject)) > 0
    || /\b(?:nearby|local|select|listed|recommended|top|best|popular)\b/i.test(context);
}

function surroundingText(value: string, name: string, radius: number): string {
  const index = value.toLocaleLowerCase().indexOf(name.toLocaleLowerCase());
  if (index < 0) return value.slice(0, Math.min(value.length, radius * 2));
  return value.slice(Math.max(0, index - radius), Math.min(value.length, index + name.length + radius));
}

function textListEvidence(
  section: string,
  name: string,
  intent: ExecutionIntent,
  location: string | undefined,
  sourceResult: SearchWebItem,
): string {
  void intent;
  void location;
  return [
    surroundingText(section, name, 220),
    sourceResult.title,
  ].join(' ');
}

function capitalizeToken(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function sourceResultIndex(_sourceResult: SearchWebItem, _name: string): number {
  return 0;
}

function mergeCandidates(candidates: SearchCandidate[]): SearchCandidate[] {
  const merged = new Map<string, SearchCandidate>();
  for (const candidate of candidates) {
    const key = candidate.name.toLocaleLowerCase();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...candidate,
        sources: [...candidate.sources],
        reasons: [...candidate.reasons],
        validationEvidence: [...candidate.validationEvidence],
      });
      continue;
    }
    existing.mentions += candidate.mentions;
    existing.confidence = Math.max(existing.confidence, candidate.confidence);
    for (const source of candidate.sources) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
    }
    for (const reason of candidate.reasons) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
    }
    if (candidate.sourceQuality < existing.sourceQuality) {
      existing.url = candidate.url;
      existing.snippet = candidate.snippet;
      existing.sourceQuality = candidate.sourceQuality;
      existing.needsLinkEnrichment = candidate.needsLinkEnrichment;
    }
    existing.subjectEvidence = uniqueStrings([...(existing.subjectEvidence ?? []), ...(candidate.subjectEvidence ?? [])]);
    existing.locationEvidence = uniqueStrings([...(existing.locationEvidence ?? []), ...(candidate.locationEvidence ?? [])]);
    existing.sourceEvidence = uniqueStrings([...(existing.sourceEvidence ?? []), ...(candidate.sourceEvidence ?? [])]);
    existing.validationEvidence = uniqueStrings([...existing.validationEvidence, ...candidate.validationEvidence]);
    existing.validationFailures = uniqueStrings([...(existing.validationFailures ?? []), ...(candidate.validationFailures ?? [])]);
    if (candidate.entityLink && (!existing.entityLink || candidate.sourceQuality <= existing.sourceQuality)) {
      existing.entityLink = candidate.entityLink;
    }
  }
  return [...merged.values()].sort((left, right) => (
    right.confidence - left.confidence
    || right.mentions - left.mentions
    || left.sourceQuality - right.sourceQuality
    || left.rank - right.rank
    || left.name.localeCompare(right.name)
  ));
}

function finalizeValidatedCandidates(
  candidates: SearchCandidate[],
  intent: ExecutionIntent,
  location: string | undefined,
  existingRejected: RejectedSearchCandidate[] = [],
  requireEntitySpecificLink = false,
  limit = 3,
): { accepted: ValidatedSearchCandidate[]; rejected: RejectedSearchCandidate[] } {
  const accepted: ValidatedSearchCandidate[] = [];
  const rejected = [...existingRejected];
  const seenAccepted = new Set<string>();
  const seenRejected = new Set<string>();

  for (const candidate of candidates) {
    const excludedByPriorTurn = priorCandidateExclusionMatch(candidate.name, intent.excludedCandidateNames);
    if (excludedByPriorTurn) {
      const key = candidate.name.toLocaleLowerCase();
      if (!seenRejected.has(key)) {
        seenRejected.add(key);
        rejected.push({
          name: candidate.name,
          validationStatus: 'rejected',
          validationFailures: [`candidate was already shown or explicitly excluded in prior context: ${excludedByPriorTurn}`],
          evidence: [candidate.url, candidate.snippet].filter(Boolean).slice(0, 2),
        });
      }
      continue;
    }
    const evidenceContext = [
      ...candidate.validationEvidence,
      candidate.snippet,
      ...(candidate.sourceEvidence ?? []),
      ...(candidate.subjectEvidence ?? []),
      ...(candidate.locationEvidence ?? []),
      candidate.url,
    ];
    const validation = validateCandidateEvidence(candidate.name, candidate.url, intent, location, evidenceContext, candidate.evidenceKind);
    validation.validationFailures.push(...compiledConstraintFailuresForCandidate(
      candidate,
      intent.validationContract,
    ));
    if (
      requireEntitySpecificLink
      && validation.linkEvidence !== 'entity-specific'
      && !allowsSourceBackedAggregateLink(candidate, validation)
    ) {
      validation.validationFailures.push('candidate lacks a source-backed entity-specific link');
    }
    if (validation.validationFailures.length > 0) {
      const key = candidate.name.toLocaleLowerCase();
      if (!seenRejected.has(key)) {
        seenRejected.add(key);
        rejected.push({
          name: candidate.name,
          validationStatus: 'rejected',
          validationFailures: validation.validationFailures,
          evidence: compactEvidence(evidenceContext).slice(0, 4),
        });
      }
      continue;
    }
    const key = candidate.name.toLocaleLowerCase();
    if (seenAccepted.has(key)) continue;
    seenAccepted.add(key);
    accepted.push({
      ...candidate,
      validationStatus: 'accepted',
      subjectMatch: true,
      entityLink: candidate.url,
      sourceEvidence: validation.sourceEvidence.length > 0 ? validation.sourceEvidence : validation.subjectEvidence,
      subjectEvidence: validation.subjectEvidence,
      locationEvidence: validation.locationEvidence,
      linkEvidence: validation.linkEvidence,
      validationFailures: [],
    });
  }

  return {
    accepted: accepted.slice(0, limit),
    rejected: dedupeRejectedCandidates(rejected),
  };
}

function compiledConstraintFailuresForCandidate(
  candidate: SearchCandidate,
  contract: ValidationContract,
): string[] {
  const failures: string[] = [];
  for (const constraint of contract.constraints) {
    if (!constraint.required) continue;
    switch (constraint.type) {
      case 'name_prefix': {
        const prefix = String(constraint.value ?? '').trim().toLocaleLowerCase();
        if (prefix && !candidate.name.trim().toLocaleLowerCase().startsWith(prefix)) {
          failures.push(constraint.failureMessage);
        }
        break;
      }
      case 'name_suffix': {
        const suffix = String(constraint.value ?? '').trim().toLocaleLowerCase();
        if (suffix && !candidate.name.trim().toLocaleLowerCase().endsWith(suffix)) {
          failures.push(constraint.failureMessage);
        }
        break;
      }
      case 'rhyme': {
        const target = String(constraint.value ?? '').trim();
        if (target && !candidateNameRhymesWith(candidate.name, target)) {
          failures.push(constraint.failureMessage);
        }
        break;
      }
      case 'exclusion': {
        const excluded = Array.isArray(constraint.value) ? constraint.value.map(String) : [];
        if (excluded.some((name) => priorCandidateExclusionMatch(candidate.name, [name]))) {
          failures.push(constraint.failureMessage);
        }
        break;
      }
      case 'location': {
        if (constraint.operator === 'outside' && typeof constraint.value === 'string') {
          const forbiddenLocation = constraint.value.toLocaleLowerCase();
          const evidence = [
            candidate.name,
            candidate.snippet,
            ...(candidate.locationEvidence ?? []),
            ...(candidate.sourceEvidence ?? []),
            ...(candidate.reasons ?? []),
          ].join(' ').toLocaleLowerCase();
          if (evidence.includes(forbiddenLocation)) failures.push(constraint.failureMessage);
        }
        break;
      }
      default:
        break;
    }
  }
  return failures;
}

function candidateNameRhymesWith(name: string, target: string): boolean {
  const lastWord = name.toLocaleLowerCase().match(/[a-z0-9]+(?=[^a-z0-9]*$)/i)?.[0] ?? '';
  const normalizedTarget = target.toLocaleLowerCase();
  if (!lastWord || !normalizedTarget) return false;
  const tail = normalizedTarget.length <= 3 ? normalizedTarget.slice(-2) : normalizedTarget.slice(-3);
  return lastWord.endsWith(tail);
}

function priorCandidateExclusionMatch(name: string, exclusions: string[]): string | undefined {
  const candidateKey = compactEntityKey(name);
  if (!candidateKey) return undefined;
  return exclusions.find((exclusion) => {
    const exclusionKey = compactEntityKey(exclusion);
    if (!exclusionKey) return false;
    return candidateKey === exclusionKey
      || candidateKey.includes(exclusionKey)
      || exclusionKey.includes(candidateKey);
  });
}

function allowsSourceBackedAggregateLink(
  candidate: SearchCandidate,
  validation: CandidateValidation,
): boolean {
  const sourceBacked = validation.subjectEvidence.length > 0
    && validation.locationEvidence.length > 0
    && validation.sourceEvidence.length > 0
    && !isForbiddenEntityLabel(candidate.name)
    && !isSearchResultOnlyUrl(candidate.url);
  if (candidate.evidenceKind === 'page-entity') return sourceBacked;
  return candidate.evidenceKind === 'page-text-list'
    && validation.subjectEvidence.length > 0
    && validation.locationEvidence.length > 0
    && validation.sourceEvidence.length > 0
    && !isForbiddenEntityLabel(candidate.name)
    && !isSearchResultOnlyUrl(candidate.url);
}

function isSearchResultOnlyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /\b(?:bing|google)\./i.test(parsed.hostname)
      || /\/search\b/i.test(parsed.pathname);
  } catch {
    return true;
  }
}

function dedupeRejectedCandidates(candidates: RejectedSearchCandidate[]): RejectedSearchCandidate[] {
  const deduped = new Map<string, RejectedSearchCandidate>();
  for (const candidate of candidates) {
    const key = candidate.name.toLocaleLowerCase();
    if (!deduped.has(key)) deduped.set(key, candidate);
  }
  return [...deduped.values()];
}

function rememberRejectedCandidates(target: RejectedSearchCandidate[], candidates: RejectedSearchCandidate[]): void {
  const seen = new Set(target.map((candidate) => candidate.name.toLocaleLowerCase()));
  for (const candidate of candidates) {
    const key = candidate.name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(candidate);
  }
}

async function appendValidatedCandidates(
  bus: IAgentBus | undefined,
  accepted: ValidatedSearchCandidate[],
  rejected: RejectedSearchCandidate[],
  source: string,
  requestedCount: number,
  validationContract?: ValidationContract,
): Promise<void> {
  if (!bus || typeof bus.append !== 'function') return;
  const acceptedCount = accepted.length;
  const missingCount = Math.max(0, requestedCount - acceptedCount);
  await bus.append({
    type: PayloadType.Result,
    intentId: `validated-candidates-${source.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80) || 'search'}`,
    output: JSON.stringify({
      type: 'validated-search-candidates',
      source,
      requestedCount,
      acceptedCount,
      missingCount,
      validationContract,
      candidates: accepted.map((candidate) => ({
        name: candidate.name,
        validationStatus: candidate.validationStatus,
        subjectMatch: candidate.subjectMatch,
        locationEvidence: candidate.locationEvidence,
        entityLink: candidate.entityLink,
        sourceEvidence: candidate.sourceEvidence,
        reasons: candidate.reasons,
      })),
      rejected: rejected.map((candidate) => ({
        name: candidate.name,
        validationStatus: candidate.validationStatus,
        validationFailures: candidate.validationFailures,
        evidence: candidate.evidence ?? [],
      })),
    }),
    ...(missingCount > 0 ? { error: `Requested ${requestedCount} accepted candidates but found ${acceptedCount}.` } : {}),
    meta: {
      actorId: 'search-analyzer',
      actorRole: 'executor',
      parentActorId: 'execute-plan',
      branchId: 'agent:executor',
      agentLabel: 'Search Analyzer',
      modelProvider: 'logact',
    },
  });
}

function rejectedSnippetFragments(item: SearchWebItem, intent: ExecutionIntent): string[] {
  return splitCandidateNames(item.snippet, intent)
    .filter((name) => !cleanCandidateName(name, intent))
    .slice(0, 3);
}

function buildSearchTurnContext(context: ResolvedExecutionContext): SearchTurnContext | undefined {
  const intent = context.intent;
  if (!intent || !context.searchResult) return undefined;
  const acceptedCandidates = (context.searchCandidates ?? [])
    .filter((candidate) => candidate.validationStatus === 'accepted')
    .map((candidate) => ({
      name: candidate.name,
      url: candidate.entityLink ?? candidate.url,
    }));
  return {
    taskText: context.conversationResolution?.context?.taskText ?? intent.currentTaskText,
    resolvedTaskText: intent.currentTaskText,
    subject: intent.subject,
    answerSubject: intent.answerSubject,
    rankingGoal: intent.rankingGoal,
    location: context.location,
    acceptedCandidates,
    rejectedLabels: [],
    sourceQueries: [
      context.webSearchResult?.query ?? context.searchResult.query,
      ...(context.localWebResearchResult?.plannedQueries ?? []).map((query) => `local:${query}`),
    ],
    requestedCount: intent.requestedCount,
    validationContract: intent.validationContract,
    timestamp: Date.now(),
  };
}

function acceptedSearchCandidateCount(context: ResolvedExecutionContext): number {
  return (context.searchCandidates ?? [])
    .filter((candidate) => candidate.validationStatus === 'accepted')
    .length;
}

function composeSearchAnswer(context: ResolvedExecutionContext): string {
  const intent = context.intent;
  const result = context.searchResult;
  if (!result || !intent) return 'I could not find search results for that request.';
  const location = context.location ? ` near ${cleanDisplayLocation(context.location)}` : '';
  const heading = `Here are ${intent.answerSubject}${location}:`;
  const candidates = (context.searchCandidates ?? [])
    .filter((candidate): candidate is ValidatedSearchCandidate => candidate.validationStatus === 'accepted');
  const requiredCount = requiredAcceptedCandidateCount(intent);
  if (candidates.length > 0 && candidates.length < requiredCount) {
    const noun = candidates.length === 1 ? 'result' : 'results';
    return [
      `I could only verify ${candidates.length} additional ${noun} for ${intent.answerSubject}${location}, but you asked for ${requiredCount}.`,
      insufficientEvidenceExplanation(intent),
      '',
      ...candidates.map((item, index) => (
        `${index + 1}. [${item.name}](${item.entityLink ?? item.url}) - Why: ${formatCandidateReason(item)}`
      )),
    ].join('\n');
  }
  if (candidates.length > 0) {
    const visibleCount = Math.max(1, Math.min(intent.requestedCount ?? 3, candidates.length));
    return [
      heading,
      '',
      ...candidates.slice(0, visibleCount).map((item, index) => (
        `${index + 1}. [${item.name}](${item.entityLink ?? item.url}) - Why: ${formatCandidateReason(item)}`
      )),
    ].join('\n');
  }
  return [
    `I could not find enough validated ${intent.answerSubject}${location} to answer confidently.`,
    insufficientEvidenceExplanation(intent),
  ].join('\n');
}

function insufficientEvidenceExplanation(intent: ExecutionIntent): string {
  const unmet = intent.validationContract.constraints
    .filter((constraint) => constraint.required)
    .filter((constraint) => !['entity_link', 'source_evidence', 'page_chrome'].includes(constraint.type))
    .map((constraint) => constraint.failureMessage.replace(/[.]+$/g, ''))
    .slice(0, 5);
  const base = 'The available search evidence did not contain enough source-backed entity names with all required signals.';
  return unmet.length > 0
    ? `${base} Unmet or under-evidenced constraints: ${unmet.join('; ')}.`
    : base;
}

function extractSearchCandidates(
  results: SearchWebItem[],
  intent: ExecutionIntent,
  location?: string,
): SearchCandidate[] {
  const candidates = new Map<string, SearchCandidate>();
  results.forEach((item, sourceOrder) => {
    const sourceName = sourceNameFromTitle(item.title);
    for (const extracted of extractCandidateNames(item, intent, sourceName, location)) {
      const key = extracted.name.toLocaleLowerCase();
      const reason = withCandidateSearchContext(extracted.reason, extracted.name, intent, location);
      const validationEvidence = compactEvidence([
        item.title,
        item.snippet,
        item.url,
      ]);
      const existing = candidates.get(key);
      if (!existing) {
        candidates.set(key, {
          name: extracted.name,
          url: item.url,
          snippet: item.snippet,
          rank: extracted.rank,
          sourceOrder,
          sourceQuality: extracted.sourceQuality,
          needsLinkEnrichment: extracted.needsLinkEnrichment,
          mentions: 1,
          sources: [sourceName],
          reasons: [reason],
          validationEvidence,
          confidence: extracted.sourceQuality === 0 ? 0.85 : 0.65,
        });
        continue;
      }
      existing.mentions += 1;
      existing.confidence = Math.max(existing.confidence, extracted.sourceQuality === 0 ? 0.85 : 0.65);
      if (!existing.sources.includes(sourceName)) existing.sources.push(sourceName);
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      existing.validationEvidence = uniqueStrings([...existing.validationEvidence, ...validationEvidence]);
      if (
        extracted.sourceQuality < existing.sourceQuality
        || (extracted.sourceQuality === existing.sourceQuality && extracted.rank < existing.rank)
      ) {
        existing.url = item.url;
        existing.snippet = item.snippet;
        existing.rank = extracted.rank;
        existing.sourceQuality = extracted.sourceQuality;
        existing.needsLinkEnrichment = extracted.needsLinkEnrichment;
        existing.sourceOrder = sourceOrder;
      }
    }
  });
  return [...candidates.values()].sort((left, right) => (
    right.mentions - left.mentions
    || left.sourceQuality - right.sourceQuality
    || left.rank - right.rank
    || left.sourceOrder - right.sourceOrder
    || left.name.localeCompare(right.name)
  ));
}

function withCandidateSearchContext(
  reason: string,
  name: string,
  intent: ExecutionIntent,
  location?: string,
): string {
  void name;
  void intent;
  void location;
  return reason;
}

function extractCandidateNames(
  item: SearchWebItem,
  intent: ExecutionIntent,
  sourceName: string,
  location?: string,
): Array<Pick<SearchCandidate, 'name' | 'rank' | 'sourceQuality' | 'needsLinkEnrichment'> & { reason: string }> {
  const ranked = parseRankedCandidates(item.snippet, sourceName);
  const listed = parseListedCandidates(item.snippet, intent, sourceName, location);
  const directTitle = isAggregateResult(item.title, intent)
    ? []
    : nameToCandidate(cleanCandidateName(item.title, intent), 1, 0, false, item.snippet || `Direct result from ${sourceName}.`);
  return [...ranked, ...listed, ...directTitle];
}

function parseRankedCandidates(snippet: string, sourceName: string): ReturnType<typeof nameToCandidate> {
  const currentFavorites = snippet.match(/\bcurrent favorites are:\s*(.+)$/i);
  const source = currentFavorites?.[1] ?? snippet;
  const entries = [...source.matchAll(/\b(\d+)\s*[:.)]\s*([^,;]+)/g)]
    .map((entry) => ({
      name: cleanCandidateName(entry[2]),
      rank: Number.parseInt(entry[1], 10),
    }))
    .filter((entry) => entry.name);
  return entries.flatMap((entry) => nameToCandidate(
    entry.name,
    entry.rank,
    0,
    true,
    `Ranked #${entry.rank} by ${sourceName}.`,
  ));
}

function parseListedCandidates(
  snippet: string,
  intent: ExecutionIntent,
  sourceName: string,
  location?: string,
): ReturnType<typeof nameToCandidate> {
  const listText = extractListSegment(snippet, intent);
  if (!listText) return [];
  return splitCandidateNames(listText, intent).flatMap((name, index) => nameToCandidate(
    name,
    index + 1,
    1,
    true,
    `Listed by ${sourceName} for ${intent.answerSubject}${location ? ` near ${cleanDisplayLocation(location)}` : ''}.`,
  ));
}

function extractListSegment(snippet: string, intent: ExecutionIntent): string | undefined {
  const explicitList = snippet
    .split(/[.!?]/)
    .map((part) => extractExplicitListSegment(part))
    .find((part) => part && looksLikeCandidateList(part, intent));
  if (explicitList) return explicitList;

  const afterDash = snippet.match(/^([^"]{0,140}?)\s+-\s+(.+)$/);
  if (afterDash && isSafeAggregateListLead(afterDash[1]) && looksLikeCandidateList(afterDash[2], intent)) return afterDash[2];
  const afterColon = snippet.match(/^([^"]{0,120}?):\s*(.+)$/);
  if (afterColon && isSafeAggregateListLead(afterColon[1]) && looksLikeCandidateList(afterColon[2], intent)) return afterColon[2];
  return undefined;
}

function isSafeAggregateListLead(value: string): boolean {
  const lead = value.trim();
  if (!lead || lead.length > 140) return false;
  if (/\b(review|reviews?|saying|answers?|questions?|what are people|this is|period|ambiance|nice|bar|bag toss|pool tables)\b/i.test(lead)) {
    return false;
  }
  return true;
}

function extractExplicitListSegment(value: string): string | undefined {
  const patterns = [
    /\b(?:include|includes|including)\s+(.+)$/i,
    /\b(?:choices|picks|options|favorites|recommendations?|results|places|venues)\s+(?:are|include|includes)\s*:?\s*(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return undefined;
}

function looksLikeCandidateList(value: string, intent: ExecutionIntent): boolean {
  const names = splitCandidateNames(value, intent);
  return names.length >= 2 || /\b\d+\s*[:.)]\s*[^,;]+/.test(value);
}

function splitCandidateNames(value: string, intent: ExecutionIntent): string[] {
  return stripListLeadIn(value)
    .replace(/\band more\b.*$/i, '')
    .replace(/\bwith\s+(?:showtimes|reviews|menus|ratings|amenities)\b.*$/i, '')
    .split(',')
    .map((name) => cleanCandidateName(name, intent))
    .filter(Boolean);
}

function stripListLeadIn(value: string): string {
  return value
    .replace(/^\s*(?:popular|top|recommended|notable|current|local|nearby)?\s*(?:choices|picks|options|favorites|recommendations?|results|places|venues)?\s*(?:around|near|in)\s+[^,.;:]+?\s+(?:include|includes|including|are)\s+/i, '')
    .replace(/^\s*(?:popular|top|recommended|notable|current|local|nearby)?\s*(?:choices|picks|options|favorites|recommendations?|results|places|venues)\s+(?:include|includes|including|are)\s*:?\s*/i, '')
    .replace(/^\s*(?:include|includes|including)\s+/i, '');
}

function nameToCandidate(
  name: string,
  rank: number,
  sourceQuality: number,
  needsLinkEnrichment: boolean,
  reason: string,
): Array<Pick<SearchCandidate, 'name' | 'rank' | 'sourceQuality' | 'needsLinkEnrichment'> & { reason: string }> {
  return name ? [{ name, rank, sourceQuality, needsLinkEnrichment, reason }] : [];
}

function cleanCandidateName(value: string, intent?: ExecutionIntent): string {
  const subjectPattern = intent ? new RegExp(`\\b${escapeRegExp(intent.answerSubject)}\\b`, 'i') : null;
  const cleaned = decodeHtmlEntities(value)
    .replace(/^\s*\d+[\).:]?\s*/, '')
    .replace(/\s+-\s+.*$/, '')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 2 || cleaned.length > 96) return '';
  if (isForbiddenEntityLabel(cleaned, intent)) return '';
  if (/^[a-z]/.test(cleaned) || /[.!?]/.test(cleaned)) return '';
  if (/^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}$/i.test(cleaned)) {
    return '';
  }
  if (/^(?:price|prices|pricing|price range|hours?)$/i.test(cleaned)) {
    return '';
  }
  if (/\b(best|top|see|last updated|current|near me|nearby|search|find|reviews?|ratings?|menus?|showt?imes?|options?|results?|traveler|travelers|gathered|location)\b/i.test(cleaned)) {
    return '';
  }
  if (/\b(?:this|that|they|there|people|answer|question|discover|find|tickets?|favorite|experience)\b/i.test(cleaned)) {
    return '';
  }
  if (/\b(?:include|includes|including|mention|mentions|say|says|according)\b/i.test(cleaned)) {
    return '';
  }
  if (/\b(?:is|are|was|were|has|have|had)\b/i.test(cleaned) && /\b(?:comfortable|fresh|friendly|clean|great|good|bad|busy|crowded|quiet|helpful|expensive|cheap)\b/i.test(cleaned)) {
    return '';
  }
  if (subjectPattern?.test(cleaned) && cleaned.split(/\s+/).length <= intent!.answerSubject.split(/\s+/).length + 2) {
    return '';
  }
  return cleaned;
}

function isGenericSubjectCategoryLabel(label: string, subject: string): boolean {
  const labelTokens = expandedTokenSet(label);
  const subjectTokens = expandedTokenSet(subject);
  if (labelTokens.size === 0 || subjectTokens.size === 0) return false;
  if (hasDistinctiveEntityTokensInsideCommand(labelTokens, subjectTokens)) return false;
  const overlap = overlapScore(labelTokens, subjectTokens);
  return overlap === labelTokens.size && labelTokens.size <= Math.max(2, subjectTokens.size);
}

function hasDistinctiveEntityTokensInsideCommand(labelTokens: Set<string>, subjectTokens: Set<string>): boolean {
  const commandTokens = new Set([
    'search',
    'find',
    'lookup',
    'look',
    'show',
    'list',
    'cite',
  ]);
  if (![...commandTokens].some((token) => subjectTokens.has(token))) return false;
  const genericEntityTokens = new Set([
    'movie',
    'movies',
    'theater',
    'theaters',
    'theatre',
    'theatres',
    'cinema',
    'cinemas',
    'restaurant',
    'restaurants',
    'bar',
    'bars',
    'cafe',
    'cafes',
    'service',
    'services',
    'company',
    'companies',
    'product',
    'products',
    'overview',
    'page',
  ]);
  const distinctive = [...labelTokens]
    .filter((token) => !genericEntityTokens.has(token))
    .filter((token) => subjectTokens.has(token));
  return distinctive.length >= 2;
}

function isGenericSubjectSectionLabel(label: string, subject: string): boolean {
  const labelTokens = tokenSet(label);
  const sectionTokens = new Set([
    'chart',
    'charts',
    'news',
    'article',
    'articles',
    'blog',
    'store',
    'shop',
    'streaming',
    'showime',
    'showimes',
    'home',
    'showtime',
    'showtimes',
    'ticket',
    'tickets',
    'offer',
    'offers',
    'deal',
    'deals',
    'coupon',
    'coupons',
    'promo',
    'promos',
    'promotion',
    'promotions',
    'trailer',
    'trailers',
    'video',
    'videos',
    'event',
    'events',
    'review',
    'reviews',
    'menu',
    'menus',
    'direction',
    'directions',
  ]);
  const sectionTokenCount = [...labelTokens].filter((token) => sectionTokens.has(token)).length;
  if (sectionTokenCount === 0 || labelTokens.size > 4) return false;
  const descriptiveTokens = [...labelTokens].filter((token) => !sectionTokens.has(token));
  if (descriptiveTokens.length === 0) return true;
  const subjectTokens = expandedTokenSet(subject);
  return descriptiveTokens.every((token) => subjectTokens.has(token));
}

function isSubjectIncompatibleSiteSectionLabel(label: string, subject: string): boolean {
  const normalizedLabel = label.toLocaleLowerCase();
  const normalizedSubject = subject.toLocaleLowerCase();
  const incompatibleSections: Array<[RegExp, RegExp]> = [
    [/\btv\b|\btelevision\b/, /\btv\b|\btelevision\b/],
    [/\bfan\s*club\b|\bfanclub\b/, /\bfan\s*club\b|\bfanclub\b/],
    [/\bnews\b|\bcharts?\b|\barticles?\b|\bblog\b/, /\bnews\b|\bcharts?\b|\barticles?\b|\bblog\b/],
    [/\bstore\b|\bshop\b|\bmerchandise\b|\bgear\b/, /\bstore\b|\bshop\b|\bmerchandise\b|\bgear\b/],
  ];
  return incompatibleSections.some(([labelPattern, subjectPattern]) => (
    labelPattern.test(normalizedLabel) && !subjectPattern.test(normalizedSubject)
  ));
}

function isAggregateSourceTitleLabel(label: string, intent: ExecutionIntent): boolean {
  const normalized = label.replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  const subjectTokens = expandedTokenSet(intent.answerSubject);
  const labelTokens = expandedTokenSet(normalized);
  const hasSubject = overlapScore(labelTokens, subjectTokens) > 0;
  if (!hasSubject) return false;
  if (/\b(?:best|top|nearest|closest|nearby|near|local|recommended|popular|reviews?|ratings?|directory|guide|search results?|listings?|yellow pages|tripadvisor|yelp|restaurantji|restaurant guru|with menus)\b/i.test(normalized)) {
    return true;
  }
  if (/\b(?:in|near|around)\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}(?:,?\s+[A-Z]{2})?\b/.test(normalized)) {
    return true;
  }
  const colonParts = normalized.split(':');
  if (colonParts.length > 1) {
    const suffixTokens = expandedTokenSet(colonParts.slice(1).join(':'));
    return overlapScore(suffixTokens, subjectTokens) > 0;
  }
  return false;
}

function isAggregateResult(title: string, intent: ExecutionIntent): boolean {
  const lowered = title.toLocaleLowerCase();
  const subjectTokens = tokenSet(intent.answerSubject);
  const titleTokens = tokenSet(lowered);
  const hasSubjectOverlap = overlapScore(titleTokens, subjectTokens) > 0;
  return hasSubjectOverlap && (
    /\b(best|top|the\s+\d+|near|around|with\s+(?:menus|reviews|showtimes)|tripadvisor|yelp)\b/i.test(lowered)
    || /\b(list|guide|directory|search results|movie\s+times?)\b/i.test(lowered)
  );
}

function sourceNameFromTitle(title: string): string {
  if (/yelp/i.test(title)) return 'Yelp';
  if (/tripadvisor/i.test(title)) return 'Tripadvisor';
  if (/google/i.test(title)) return 'Google';
  if (/menus|reviews/i.test(title)) return 'a review source';
  if (/showtimes|fandango|atom/i.test(title)) return 'a showtimes source';
  return 'the search result';
}

function sourceNameFromUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return undefined;
  }
}

function formatCandidateReason(candidate: SearchCandidate): string {
  const sourceEvidence = candidate.sourceEvidence
    ?.find((item) => !isListSummaryEvidence(item, candidate.name))
    ?? candidate.subjectEvidence?.find((item) => !isListSummaryEvidence(item, candidate.name));
  const locationEvidence = candidate.locationEvidence
    ?.find((item) => !isListSummaryEvidence(item, candidate.name));
  if (sourceEvidence && locationEvidence && sourceEvidence !== locationEvidence) {
    return `${sourceEvidence} Location evidence: ${locationEvidence}`;
  }
  if (sourceEvidence) return sourceEvidence;
  if (locationEvidence) return `Location evidence: ${locationEvidence}`;
  const primaryReason = candidate.reasons[0] ?? `Mentioned by ${candidate.sources.join(' and ')}.`;
  const snippet = candidate.snippet.trim();
  if (snippet && !primaryReason.includes(snippet) && snippet.length <= 180) {
    return `${primaryReason} ${snippet}`;
  }
  const extraSources = candidate.sources
    .filter((source) => !primaryReason.includes(source))
    .slice(0, 2);
  return extraSources.length > 0
    ? `${primaryReason} Also mentioned by ${extraSources.join(' and ')}.`
    : primaryReason;
}

function isListSummaryEvidence(value: string, name: string): boolean {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!segmentMentionsCandidate(normalized, name)) return false;
  return /\b(?:include|includes|including|favorites|choices|picks|options|recommendations?|results|places|venues)\b/i.test(normalized)
    && /[,;]\s*[A-Z0-9]/.test(normalized);
}

async function enrichSearchCandidates({
  candidates,
  intent,
  location,
  call,
}: {
  candidates: SearchCandidate[];
  intent: ExecutionIntent;
  location?: string;
  call: (toolId: string, args: unknown) => Promise<unknown>;
}): Promise<SearchCandidate[]> {
  const targetEntityLinks = Math.max(3, intent.requestedCount ?? 3);
  const topCandidates = candidates.slice(0, candidateLimitForIntent(intent));
  const enriched: SearchCandidate[] = [];
  let entitySpecificLinks = 0;
  for (const candidate of topCandidates) {
    if (!candidate.needsLinkEnrichment) {
      enriched.push(candidate);
      if (hasEntitySpecificLink(candidate)) entitySpecificLinks += 1;
      if (entitySpecificLinks >= targetEntityLinks) break;
      continue;
    }
    const query = buildCandidateLinkQuery(candidate.name, intent, location);
    const result = normalizeSearchResult(
      await call(REQUIREMENT_TOOL_IDS.search, { query, limit: 1 }),
      query,
    );
    const link = pickDirectCandidateLink(result, candidate, intent);
    const enrichedCandidate = link
      ? {
        ...candidate,
        url: link.url,
        snippet: [link.title, link.snippet || candidate.snippet].filter(Boolean).join('. '),
        reasons: uniqueStrings([
          ...candidate.reasons,
          `Entity-specific source result: ${link.title}.`,
        ]),
        validationEvidence: uniqueStrings([
          ...candidate.validationEvidence,
          `Entity-specific source result: ${link.title}. ${link.snippet}`,
          link.url,
        ]),
        needsLinkEnrichment: false,
      }
      : candidate;
    enriched.push(enrichedCandidate);
    if (hasEntitySpecificLink(enrichedCandidate)) entitySpecificLinks += 1;
    if (entitySpecificLinks >= targetEntityLinks) break;
  }
  return [...enriched, ...candidates.slice(topCandidates.length)];
}

function hasEntitySpecificLink(candidate: SearchCandidate): boolean {
  return classifyLinkEvidence(candidate.url, candidate.name, [candidate.url]) === 'entity-specific';
}

function buildCandidateLinkQuery(name: string, intent: ExecutionIntent, location?: string): string {
  const locationPart = location ? cleanDisplayLocation(location).replace(/,/g, '') : '';
  return [`"${decodeHtmlEntities(name)}"`, locationPart, intent.answerSubject, 'official reviews']
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildEntityDiscoveryQuery(intent: ExecutionIntent, location?: string): string {
  const locationPart = location ? cleanDisplayLocation(location).replace(/,/g, '') : '';
  const constraintPart = searchQueryConstraintTerms(intent.validationContract).join(' ');
  return [intent.answerSubject, 'names', locationPart ? 'near' : '', locationPart, constraintPart]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickDirectCandidateLink(
  result: SearchWebResult,
  candidate: SearchCandidate,
  intent: ExecutionIntent,
): SearchWebItem | undefined {
  if (result.status !== 'found') return undefined;
  return result.results.find((item) => (
    !isAggregateResult(item.title, intent)
    && isCandidateSpecificSearchResult(item, candidate, intent)
  ));
}

function isCandidateSpecificSearchResult(
  item: SearchWebItem,
  candidate: SearchCandidate,
  intent: ExecutionIntent,
): boolean {
  if (intent.locationRequired && isReferenceOrDefinitionResult(item)) return false;
  const candidateName = candidate.name.replace(/\s+/g, ' ').trim();
  const titleAndUrl = `${item.title} ${item.url}`;
  const compactName = compactEntityKey(candidateName);
  const compactItem = compactEntityKey(titleAndUrl);
  if (compactName.length >= 6 && compactItem.includes(compactName)) return true;
  if (new RegExp(`\\b${escapedFlexiblePhrase(candidateName)}\\b`, 'i').test(titleAndUrl)) return true;

  const distinctiveTokens = distinctiveEntityTokens(candidateName, intent.answerSubject);
  if (distinctiveTokens.length < 2) return false;
  const itemTokens = expandedTokenSet(titleAndUrl);
  return distinctiveTokens.filter((token) => itemTokens.has(token)).length >= 2;
}

function distinctiveEntityTokens(name: string, subject: string): string[] {
  const subjectTokens = expandedTokenSet(subject);
  const generic = new Set([
    ...subjectTokens,
    'best',
    'top',
    'near',
    'nearby',
    'local',
    'around',
    'review',
    'reviews',
    'official',
    'home',
  ]);
  return [...expandedTokenSet(name)]
    .filter((token) => !generic.has(token))
    .filter((token) => token.length > 2);
}

function isReferenceOrDefinitionResult(item: SearchWebItem): boolean {
  const haystack = `${item.title} ${item.url}`.toLocaleLowerCase();
  return /\b(?:dictionary|definition|meaning|thesaurus|wikipedia|wiktionary|encyclopedia)\b/.test(haystack);
}

function cleanDisplayLocation(value: string): string {
  return value
    .replace(/[.;:,\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resultFromNeedsUserInput(result: unknown, steps: number): AgentRunResult | null {
  if (!isRecord(result) || result.status !== 'needs_user_input') return null;
  const prompt = typeof result.prompt === 'string' && result.prompt.trim()
    ? result.prompt.trim()
    : 'Please provide the missing information before I continue.';
  return {
    text: prompt,
    steps,
    blocked: true,
    needsUserInput: true,
    elicitation: result,
  };
}

function isToolAllowedAndAvailable(runtime: ToolAgentRuntime, allowedToolIds: Set<string>, toolId: string): boolean {
  return allowedToolIds.has(toolId) && Boolean(runtime.tools[toolId] || runtime.generatedTools?.[toolId]);
}

function messageContentToText(content: ModelMessage['content']): string {
  if (typeof content === 'string') return content;
  return content
    .map((part) => (part.type === 'text' ? part.text : `[${part.type}]`))
    .join('\n');
}

export function taskFromMessages(messages: ModelMessage[]): string {
  const last = messages.at(-1);
  return last ? taskFromText(messageContentToText(last.content)) : '';
}

function taskFromText(text: string): string {
  const enhanced = text.match(/^Enhanced task prompt:\s*(.+)$/im)?.[1];
  if (enhanced?.trim()) return enhanced.trim();
  const original = text.match(/^Original request:\s*(.+)$/im)?.[1];
  if (original?.trim()) return original.trim();
  return text.trim();
}

function normalizeNaturalLanguage(text: string): string {
  return text
    .replace(/[’]/g, "'")
    .replace(/\bwhat're\b/ig, 'what are')
    .replace(/\bwhat's\b/ig, 'what is')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9' ]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !['the', 'and', 'for', 'near', 'with'].includes(token)));
}

function compactEntityKey(value: string): string {
  return decodeHtmlEntities(value)
    .toLocaleLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

function expandedTokenSet(value: string): Set<string> {
  const expanded = new Set<string>();
  for (const token of tokenSet(value)) {
    expanded.add(token);
    if (token.endsWith('s') && token.length > 4) expanded.add(token.slice(0, -1));
    if (!token.endsWith('s') && token.length > 3) expanded.add(`${token}s`);
    for (const alias of tokenAliases(token)) expanded.add(alias);
  }
  return expanded;
}

function tokenAliases(token: string): string[] {
  switch (token) {
    case 'theater':
    case 'theaters':
    case 'theatre':
    case 'theatres':
      return ['cinema', 'cinemas', 'movie'];
    case 'cinema':
    case 'cinemas':
      return ['theater', 'theaters', 'theatre', 'theatres', 'movie'];
    case 'restaurant':
    case 'restaurants':
      return ['dining', 'eatery', 'eateries'];
    case 'cafe':
    case 'cafes':
      return ['coffee'];
    case 'coffee':
      return ['cafe', 'cafes'];
    case 'bar':
    case 'bars':
      return ['pub', 'pubs', 'tavern', 'taverns'];
    default:
      return [];
  }
}

function overlapScore(left: Set<string>, right: Set<string>): number {
  let score = 0;
  for (const token of left) {
    if (right.has(token)) score += 1;
  }
  return score;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
