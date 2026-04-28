import type { ModelMessage } from '@ai-sdk/provider-utils';
import { PayloadType, type IAgentBus } from 'logact';
import type { ToolPlanningCallbacks, ToolAgentRuntime, ToolPlan } from '../tool-agents/tool-agent';
import { callTool } from '../tool-agents/tool-agent';
import type { AgentRunResult } from './agentRunner';
import type { BusEntryStep } from '../types';

export interface ExecutionRequirement {
  kind: 'location' | 'web-search';
  reason: string;
}

export interface ExecutionIntent {
  currentTaskText: string;
  subject: string;
  answerSubject: string;
  rankingModifier?: string;
  rankingGoal?: 'best' | 'worst' | 'closest' | 'most-popular' | 'recommended' | 'current';
  locationRequired: boolean;
  externalSearchRequired: boolean;
  topicPreferences: string[];
  prefersCitations: boolean;
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
  searchResult?: SearchWebResult;
  searchCandidates?: SearchCandidate[];
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
  readPage: 'webmcp:read_web_page',
} as const;

const MAX_PAGES_TO_READ = 2;
const MAX_DISCOVERY_SEARCH_RESULTS = 5;
const MAX_CANDIDATES_TO_ENRICH = 4;
const FORBIDDEN_ENTITY_LABEL_PATTERN = /^(?:movies?|theaters?|theatres?|cinemas?|trailers?|teasers?|videos?|clips?|tv shows?|showtimes?|tickets?|reviews?|menus?|directions?|hours?|locations?|search|find|home|main content|skip to main content|skip navigation|privacy|terms|sign in|log in|subscribe|load more|see all|view all|read more|learn more)$/i;
const FORBIDDEN_ENTITY_LABEL_WORD_PATTERN = /\b(?:trailers?|teasers?|showt?imes?|tickets?|ticketing|tv shows?|streaming|coming\s+soon|movie\s+charts?|movie\s+news|skip to main content|main content|screen\s+reader|accessibility|promo(?:tion)?s?|offers?|coupon|redeem)\b/i;
const SITE_SECTION_LABEL_PATTERN = /^(?:at\s+home|coming\s+soon|streaming|fan\s*store|store|shop|merchandise|gear|gift cards?|rewards?|offers?|deals?|coupons?|promos?|promotions?|charts?|news|articles?|blog|photos?|videos?|clips?|trailers?|tv shows?|events?|calendar|account|profile|help|support|contact|about|screen\s+reader\s+users?|accessibility|ticketing)$/i;
const TECHNICAL_ARTIFACT_LABEL_PATTERN = /^(?:(?:multi|single|top|bottom|side|leaderboard|banner|box|native|display|sponsor(?:ed)?)\s+)?(?:ad|ads|adunit|adunits|advertisement|banner|logo|multi\s+logo|box\s+ad|tracking|analytics|pixel|beacon|script|style|stylesheet|css|font|font\s+family|serif|sans\s+serif|arial|helvetica|georgia|palatino|palatino\s+linotype|times\s+new\s+roman)$/i;
const TECHNICAL_ARTIFACT_WORD_PATTERN = /\b(?:adconfig|adunit|adunits|advertis(?:e|ing|ement)|doubleclick|googletag|analytics|tracking|pixel|font-family|stylesheet|css|script|window\.[a-z0-9_$]+|pageType|theaterselectionpage)\b/i;
const CONTENT_NAVIGATION_ARTIFACT_WORD_PATTERN = /\b(?:featured|ticketing|what\s+to\s+watch|watch\s+new|new\s+trailers?|made\s+in\s+hollywood|showt?imes?\s+highlights?|trending|content\s+(?:area|bucket|section)|screenx|fan\s*club|sign\s*in\/?join)\b/i;

export async function resolveExecutionRequirements({
  runtime,
  plan,
  messages,
  executionContext,
  callbacks,
}: ResolveExecutionRequirementsOptions): Promise<RequirementResolutionResult> {
  const intent = inferExecutionIntent(messages);
  const requirements = detectRequirements(intent);
  if (requirements.length === 0) {
    return { status: 'continue', steps: 0 };
  }

  const allowedToolIds = new Set([
    ...plan.selectedToolIds,
    ...(executionContext?.toolPolicy?.allowedToolIds ?? []),
  ]);
  let steps = 0;
  const context: ResolvedExecutionContext = { requirements, intent };
  const call = async (toolId: string, args: unknown) => {
    steps += 1;
    return callObservedTool(
      runtime,
      toolId,
      args,
      callbacks,
      steps,
      executionContext?.bus,
      executionContext?.validationCriteria ?? [],
    );
  };

  if (intent.locationRequired) {
    const resolved = await resolveLocation({
      runtime,
      allowedToolIds,
      taskText: intent.currentTaskText,
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
    if (!isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.search)) {
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
    const searchResult = await call(REQUIREMENT_TOOL_IDS.search, { query: context.searchQuery, limit: 3 });
    context.searchResult = normalizeSearchResult(searchResult, context.searchQuery);
    if (context.searchResult.status === 'found' && context.searchResult.results.length > 0) {
      context.searchCandidates = await fulfillSearchCandidates({
        searchResult: context.searchResult,
        intent,
        location: context.location,
        allowedToolIds,
        runtime,
        bus: executionContext?.bus,
        call,
      });
      const text = composeSearchAnswer(context);
      if ((context.searchCandidates ?? []).length === 0) {
        return {
          status: 'fulfilled',
          steps,
          result: {
            text,
            steps,
            failed: true,
            error: `No validated ${intent.answerSubject} candidates were found in the search evidence.`,
          },
          context,
        };
      }
      return {
        status: 'fulfilled',
        steps,
        result: { text, steps },
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
      reason: context.searchResult.reason,
    });
    return { status: 'blocked', steps: blocked.steps, result: blocked.result, context };
  }

  return { status: 'continue', steps, context };
}

async function resolveLocation({
  runtime,
  allowedToolIds,
  taskText,
  call,
}: {
  runtime: ToolAgentRuntime;
  allowedToolIds: Set<string>;
  taskText: string;
  call: (toolId: string, args: unknown) => Promise<unknown>;
}): Promise<{ location?: string; memoryResult?: unknown }> {
  let memoryResult: unknown;
  if (isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.recall)) {
    memoryResult = await call(REQUIREMENT_TOOL_IDS.recall, { limit: 10 });
    const recalled = extractRecalledLocation(memoryResult);
    if (recalled) return { location: recalled, memoryResult };
  }

  if (isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.location)) {
    const location = await call(REQUIREMENT_TOOL_IDS.location, {});
    const browserLocation = extractBrowserLocation(location);
    if (browserLocation) return { location: browserLocation, memoryResult };
  }

  return { location: extractStatedLocation(taskText), memoryResult };
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

async function callObservedTool(
  runtime: ToolAgentRuntime,
  toolId: string,
  args: unknown,
  callbacks: ToolPlanningCallbacks,
  step: number,
  bus?: IAgentBus,
  validationCriteria: string[] = [],
): Promise<unknown> {
  const toolCallId = `execution-requirement-${step}`;
  callbacks.onToolCall?.(toolId, args, toolCallId);
  try {
    const result = await callTool(runtime, toolId, args);
    callbacks.onToolResult?.(toolId, args, result, false, toolCallId);
    await appendToolResult(bus, toolId, result, step);
    await appendToolValidation(bus, toolId, args, result, step, false, validationCriteria);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    callbacks.onToolResult?.(toolId, args, message, true, toolCallId);
    await appendToolResult(bus, toolId, message, step, true);
    await appendToolValidation(bus, toolId, args, message, step, true, validationCriteria);
    return { status: 'unavailable', reason: message };
  }
}

async function appendToolResult(
  bus: IAgentBus | undefined,
  toolId: string,
  result: unknown,
  step: number,
  isError = false,
): Promise<void> {
  if (!bus || typeof bus.append !== 'function') return;
  const output = stringifyForBus(result);
  await bus.append({
    type: PayloadType.Result,
    intentId: `executor-tool-${step}-${toolId.replace(/[^a-z0-9_-]+/gi, '-')}`,
    output,
    ...(isError ? { error: output } : {}),
    meta: {
      actorId: toolId,
      actorRole: 'tool',
      parentActorId: 'execute-plan',
      branchId: 'agent:executor',
      agentLabel: toolId,
      modelProvider: 'tool',
    },
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
      args,
      outputPreview: resultText.length > 500 ? `${resultText.slice(0, 497)}...` : resultText,
    }),
    ...(isError || failedByStatus ? { error: resultText } : {}),
    meta: {
      actorId: 'validation-agent',
      actorRole: 'verifier',
      parentActorId: toolId,
      branchId: 'agent:executor',
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

function inferExecutionIntent(messages: ModelMessage[]): ExecutionIntent {
  const currentTaskText = taskFromMessages(messages);
  const locationRequired = isLocationDependentTask(currentTaskText);
  const externalSearchRequired = requiresExternalSearch(currentTaskText);
  const subject = inferSubject(currentTaskText);
  const answerSubject = normalizeAnswerSubject(subject);
  const rankingGoal = inferRankingGoal(currentTaskText);
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
  };
}

function isLocationDependentTask(text: string): boolean {
  return /\b(near me|nearby|around me|close to me|in my area|local|near us|around us)\b/i.test(text);
}

function requiresExternalSearch(text: string): boolean {
  return /\b(best|top|recommend|recommendations?|search|find|list|nearby|near me|around me|current|latest|today|showtimes?|reviews?|options?)\b/i.test(text);
}

function buildSearchQuery(intent: ExecutionIntent, location?: string): string {
  const normalizedLocation = location ? cleanDisplayLocation(location).replace(/,/g, '') : '';
  const preferencePart = compatibleTopicPreferences(intent).join(' ');
  return [intent.rankingModifier, preferencePart, intent.subject, normalizedLocation]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim() || intent.subject;
}

function inferRankingGoal(text: string): ExecutionIntent['rankingGoal'] {
  if (/\b(worst|lowest rated|most disliked)\b/i.test(text)) return 'worst';
  if (/\b(closest|nearest)\b/i.test(text)) return 'closest';
  if (/\b(most popular|popular)\b/i.test(text)) return 'most-popular';
  if (/\b(latest|current|today)\b/i.test(text)) return 'current';
  if (/\b(best|top)\b/i.test(text)) return 'best';
  if (/\b(recommend|recommendations?)\b/i.test(text)) return 'recommended';
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
    case 'current':
      return 'current';
    case 'best':
      return 'best';
    case 'recommended':
      return 'recommended';
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
    .replace(/\b(?:can you|could you|please|i need|show me|give me|tell me|help me|look up|search for|find|list|recommend)\b/ig, ' ')
    .replace(/\b(?:the|a|an)\b/ig, ' ')
    .replace(/\b(?:best|top|worst|closest|nearest|popular|most popular|recommended|recommendations?|options?|results?)\b/ig, ' ')
    .replace(/\b(?:near me|nearby|around me|close to me|in my area|local|near us|around us)\b/ig, ' ')
    .replace(/\b(?:current|latest|today)\b/ig, ' ')
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

function extractBrowserLocation(result: unknown): string | undefined {
  if (!isRecord(result) || result.status !== 'available') return undefined;
  const latitude = typeof result.latitude === 'number' ? result.latitude : null;
  const longitude = typeof result.longitude === 'number' ? result.longitude : null;
  if (latitude === null || longitude === null) return undefined;
  return `${latitude},${longitude}`;
}

function extractStatedLocation(text: string): string | undefined {
  const stateWithComma = text.match(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*,\s*[A-Z]{2})\b/);
  if (stateWithComma) return cleanDisplayLocation(stateWithComma[1]);
  const stateWithoutComma = text.match(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+\s+(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY))\b/);
  if (stateWithoutComma) return cleanDisplayLocation(stateWithoutComma[1]);
  const near = text.match(/\b(?:in|around|for)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})\b/);
  return near?.[1] ? cleanDisplayLocation(near[1]) : undefined;
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
        const title = typeof item.title === 'string' ? item.title.trim() : '';
        const url = typeof item.url === 'string' ? item.url.trim() : '';
        const snippet = typeof item.snippet === 'string' ? item.snippet.trim() : '';
        return title && url ? { title, url, snippet } : null;
      })
      .filter((item): item is { title: string; url: string; snippet: string } => Boolean(item))
    : [];
  return {
    status: results.length > 0 && status === 'found' ? 'found' : status,
    query: typeof result.query === 'string' && result.query.trim() ? result.query.trim() : query,
    results,
    ...(typeof result.reason === 'string' && result.reason.trim() ? { reason: result.reason.trim() } : {}),
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

  let prevalidated = finalizeValidatedCandidates(candidates, intent, location, rejectedCandidates, false, MAX_CANDIDATES_TO_ENRICH);
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
    prevalidated = finalizeValidatedCandidates(candidates, intent, location, rejectedCandidates, false, MAX_CANDIDATES_TO_ENRICH);
  }
  rememberRejectedCandidates(rejectedCandidates, prevalidated.rejected);
  const enrichedCandidates = await enrichSearchCandidates({
    candidates: prevalidated.accepted,
    intent,
    location,
    call,
  });
  let validated = finalizeValidatedCandidates(enrichedCandidates, intent, location, rejectedCandidates, true);
  if (validated.accepted.length === 0 && isToolAllowedAndAvailable(runtime, allowedToolIds, REQUIREMENT_TOOL_IDS.search)) {
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
      MAX_CANDIDATES_TO_ENRICH,
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
  await appendValidatedCandidates(bus, validated.accepted, validated.rejected, searchResult.query);
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
    ...(typeof result.title === 'string' && result.title.trim() ? { title: result.title.trim() } : {}),
    ...(typeof result.text === 'string' && result.text.trim() ? { text: result.text.trim() } : {}),
    links: Array.isArray(result.links)
      ? result.links
        .map((link) => {
          if (!isRecord(link)) return null;
          const text = typeof link.text === 'string' ? link.text.trim() : '';
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
          const name = typeof entity.name === 'string' ? entity.name.trim() : '';
          const entityUrl = typeof entity.url === 'string' && entity.url.trim() ? entity.url.trim() : undefined;
          const evidence = typeof entity.evidence === 'string' && entity.evidence.trim() ? entity.evidence.trim() : 'page evidence';
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
          const label = typeof observation.label === 'string' ? observation.label.trim() : '';
          const observationUrl = typeof observation.url === 'string' && observation.url.trim()
            ? observation.url.trim()
            : undefined;
          const evidence = typeof observation.evidence === 'string' && observation.evidence.trim()
            ? observation.evidence.trim()
            : 'page observation';
          const localContext = typeof observation.localContext === 'string' && observation.localContext.trim()
            ? observation.localContext.trim()
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
    ...(typeof result.reason === 'string' && result.reason.trim() ? { reason: result.reason.trim() } : {}),
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
  if (validation.validationFailures.length > 0) {
    rejectedCandidates?.push({
      name,
      validationStatus: 'rejected',
      validationFailures: validation.validationFailures,
      evidence: compactEvidence(evidenceContext).slice(0, 4),
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
  return value
    .replace(/^\s*\d+[\).:]?\s*/, '')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
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
    || isTechnicalPageArtifactLabel(normalized)
    || isContentNavigationArtifactLabel(normalized)
    || (subject ? isGenericSubjectCategoryLabel(normalized, subject) : false)
    || (subject ? isGenericSubjectSectionLabel(normalized, subject) : false)
    || (subject ? isSubjectIncompatibleSiteSectionLabel(normalized, subject) : false);
}

function isForbiddenEntityLabel(name: string, intent?: ExecutionIntent): boolean {
  const normalized = name.replace(/^['"]|['"]$/g, '').trim();
  return isGenericNonEntityLabel(normalized, intent?.answerSubject);
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
  if (/^(?:page link|page text|source page|source result|page evidence|page navigation link|account action link|site community section link|page content bucket link|page store section link)$/i.test(normalized)) {
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
  const compactName = compactEntityKey(name);
  const directLinkEvidence = evidenceContext
    .filter((item) => /^Entity-specific source result:/i.test(item));
  const linkHaystack = `${parsed.hostname} ${parsed.pathname} ${directLinkEvidence.join(' ')}`;
  const compactLinkHaystack = compactEntityKey(linkHaystack);
  if (compactName.length >= 6 && compactLinkHaystack.includes(compactName)) return 'entity-specific';
  const distinctiveTokens = distinctiveLinkTokens(name);
  const haystackTokens = tokenSet(linkHaystack);
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
  const locationText = location ? ` near ${cleanDisplayLocation(location)}` : '';
  return [
    `${name} appears in a source section for ${intent.answerSubject}${locationText}.`,
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
      merged.set(key, { ...candidate, sources: [...candidate.sources], reasons: [...candidate.reasons] });
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
    const evidenceContext = [
      ...candidate.reasons,
      candidate.snippet,
      ...(candidate.sourceEvidence ?? []),
      ...(candidate.subjectEvidence ?? []),
      ...(candidate.locationEvidence ?? []),
      candidate.url,
    ];
    const validation = validateCandidateEvidence(candidate.name, candidate.url, intent, location, evidenceContext, candidate.evidenceKind);
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

function allowsSourceBackedAggregateLink(
  candidate: SearchCandidate,
  validation: CandidateValidation,
): boolean {
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
): Promise<void> {
  if (!bus || typeof bus.append !== 'function') return;
  await bus.append({
    type: PayloadType.Result,
    intentId: `validated-candidates-${source.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80) || 'search'}`,
    output: JSON.stringify({
      type: 'validated-search-candidates',
      source,
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
    ...(accepted.length === 0 ? { error: 'No accepted structured candidates.' } : {}),
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

function composeSearchAnswer(context: ResolvedExecutionContext): string {
  const intent = context.intent;
  const result = context.searchResult;
  if (!result || !intent) return 'I could not find search results for that request.';
  const location = context.location ? ` near ${cleanDisplayLocation(context.location)}` : '';
  const heading = `Here are ${intent.answerSubject}${location}:`;
  const candidates = (context.searchCandidates ?? extractSearchCandidates(result.results, intent, context.location))
    .filter((candidate) => candidate.validationStatus === undefined || candidate.validationStatus === 'accepted');
  if (candidates.length > 0) {
    return [
      heading,
      '',
      ...candidates.slice(0, 3).map((item, index) => (
        `${index + 1}. [${item.name}](${item.entityLink ?? item.url}) - Why: ${formatCandidateReason(item)}`
      )),
    ].join('\n');
  }
  return [
    `I could not find enough validated ${intent.answerSubject}${location} to answer confidently.`,
    'The available search evidence did not contain source-backed entity names with the required subject and location signals.',
  ].join('\n');
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
          confidence: extracted.sourceQuality === 0 ? 0.85 : 0.65,
        });
        continue;
      }
      existing.mentions += 1;
      existing.confidence = Math.max(existing.confidence, extracted.sourceQuality === 0 ? 0.85 : 0.65);
      if (!existing.sources.includes(sourceName)) existing.sources.push(sourceName);
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
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
  const cleaned = value
    .replace(/^\s*\d+[\).:]?\s*/, '')
    .replace(/\s+-\s+.*$/, '')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 2 || cleaned.length > 96) return '';
  if (isForbiddenEntityLabel(cleaned, intent)) return '';
  if (/^[a-z]/.test(cleaned) || /[.!?]/.test(cleaned)) return '';
  if (/^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}$/i.test(cleaned)) {
    return '';
  }
  if (/\b(best|top|see|last updated|current|near me|nearby|search|find|reviews?|ratings?|menus?|showt?imes?|options?|results?|traveler|travelers|gathered|location|price|hours?)\b/i.test(cleaned)) {
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
  const overlap = overlapScore(labelTokens, subjectTokens);
  return overlap === labelTokens.size && labelTokens.size <= Math.max(2, subjectTokens.size);
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

function isAggregateResult(title: string, intent: ExecutionIntent): boolean {
  const lowered = title.toLocaleLowerCase();
  const subjectTokens = tokenSet(intent.answerSubject);
  const titleTokens = tokenSet(lowered);
  const hasSubjectOverlap = overlapScore(titleTokens, subjectTokens) > 0;
  return hasSubjectOverlap && (
    /\b(best|top|the\s+\d+|near|around|with\s+(?:menus|reviews|showtimes)|tripadvisor|yelp)\b/i.test(lowered)
    || /\b(list|guide|directory|search results)\b/i.test(lowered)
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
  const topCandidates = candidates.slice(0, MAX_CANDIDATES_TO_ENRICH);
  const enriched: SearchCandidate[] = [];
  let entitySpecificLinks = 0;
  for (const candidate of topCandidates) {
    if (!candidate.needsLinkEnrichment) {
      enriched.push(candidate);
      if (hasEntitySpecificLink(candidate)) entitySpecificLinks += 1;
      if (entitySpecificLinks >= 3) break;
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
        needsLinkEnrichment: false,
      }
      : candidate;
    enriched.push(enrichedCandidate);
    if (hasEntitySpecificLink(enrichedCandidate)) entitySpecificLinks += 1;
    if (entitySpecificLinks >= 3) break;
  }
  return [...enriched, ...candidates.slice(topCandidates.length)];
}

function hasEntitySpecificLink(candidate: SearchCandidate): boolean {
  return classifyLinkEvidence(candidate.url, candidate.name, [candidate.url]) === 'entity-specific';
}

function buildCandidateLinkQuery(name: string, intent: ExecutionIntent, location?: string): string {
  const locationPart = location ? cleanDisplayLocation(location).replace(/,/g, '') : '';
  return [`"${name}"`, locationPart, intent.answerSubject, 'official reviews']
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildEntityDiscoveryQuery(intent: ExecutionIntent, location?: string): string {
  const locationPart = location ? cleanDisplayLocation(location).replace(/,/g, '') : '';
  return [intent.answerSubject, 'names', locationPart ? 'near' : '', locationPart]
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
  return allowedToolIds.has(toolId) && Boolean(runtime.tools[toolId]);
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
  return value
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
