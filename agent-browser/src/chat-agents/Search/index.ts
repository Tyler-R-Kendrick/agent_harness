import type { ToolDescriptor } from '../../tools';

export const COMPOSITE_SEARCH_AGENT_ID = 'search-agent';
export const COMPOSITE_SEARCH_AGENT_LABEL = 'Search Agent';

export type SearchProviderKind = 'web' | 'local-web-research' | 'crawler' | 'custom';

export type SearchContentPlan = {
  depth: 0 | 1 | 2;
  maxPagesToExtract: number;
  reason: string;
};

export type CompositeSearchRequest = {
  question: string;
  query: string;
  subject?: string;
  location?: string;
  rankingGoal?: string;
  limit: number;
  signal?: AbortSignal;
};

export type SearchProviderRequest = CompositeSearchRequest & {
  contentPlan: SearchContentPlan;
};

export type SearchProviderError = {
  providerId: string;
  message: string;
  recoverable: boolean;
};

export type SearchProviderResultItem = {
  title: string;
  url: string;
  snippet?: string;
  rank?: number;
  score?: number;
  metadata?: Record<string, unknown>;
};

export type SearchProviderResult = {
  status: 'found' | 'empty' | 'unavailable';
  query: string;
  results: SearchProviderResultItem[];
  errors?: SearchProviderError[];
  reason?: string;
};

export type CompositeSearchResultItem = {
  title: string;
  url: string;
  snippet: string;
  providerIds: string[];
  providerLabels: string[];
  rank: number;
  score: number;
  metadata?: Record<string, unknown>;
};

export type NormalizedSearchProviderResult = {
  providerId: string;
  providerLabel: string;
  status: 'found' | 'empty' | 'unavailable';
  query: string;
  results: CompositeSearchResultItem[];
  errors: SearchProviderError[];
};

export type CompositeSearchResult = {
  status: 'found' | 'empty' | 'unavailable';
  query: string;
  results: CompositeSearchResultItem[];
  providerResults: NormalizedSearchProviderResult[];
  errors: SearchProviderError[];
  contentPlan: SearchContentPlan;
};

export type SearchProviderAdapter = {
  id: string;
  label: string;
  kinds: SearchProviderKind[];
  isEnabled?: (request: CompositeSearchRequest) => boolean;
  search: (request: SearchProviderRequest) => Promise<SearchProviderResult> | SearchProviderResult;
};

export type SearchReranker = {
  rerank: (input: {
    request: CompositeSearchRequest;
    contentPlan: SearchContentPlan;
    results: CompositeSearchResultItem[];
  }) => CompositeSearchResultItem[];
};

export type SearchCrawler = {
  plan: (request: CompositeSearchRequest) => SearchContentPlan;
};

export type CompositeSearchAgentOptions = {
  providers: SearchProviderAdapter[];
  crawler?: SearchCrawler;
  reranker?: SearchReranker;
};

export type DefaultSearchRerankerOptions = {
  providerWeights?: Record<string, number>;
};

export interface CompositeSearchAgentEvalResult {
  passed: boolean;
  score: number;
  checks: {
    usesProviderRegistry: boolean;
    includesWebProvider: boolean;
    includesLocalResearchProvider: boolean;
    usesCrawlerDepth: boolean;
    usesDynamicReranking: boolean;
    avoidsGenericCliParsing: boolean;
  };
}

export function createSearchProviderAdapter(adapter: SearchProviderAdapter): SearchProviderAdapter {
  return adapter;
}

export class DefaultSearchCrawler implements SearchCrawler {
  plan(request: CompositeSearchRequest): SearchContentPlan {
    const text = `${request.question} ${request.query} ${request.rankingGoal ?? ''}`.toLowerCase();
    const localOrRanked = Boolean(request.location)
      || /\b(best|top|recommend|recommended|recommendations?|reviews?|near me|nearby|near|local|compare|bars?|restaurants?|theat(?:er|re)s?|cafes?)\b/i.test(text);
    if (localOrRanked) {
      return {
        depth: 2,
        maxPagesToExtract: Math.max(2, Math.min(5, request.limit)),
        reason: 'Local or ranked search needs crawled source evidence before answer selection.',
      };
    }
    const currentFact = /\b(current|latest|today|release|version|date|news|recent)\b/i.test(text);
    if (currentFact) {
      return {
        depth: 1,
        maxPagesToExtract: Math.min(2, Math.max(1, request.limit)),
        reason: 'Current factual search needs shallow source confirmation.',
      };
    }
    return {
      depth: 0,
      maxPagesToExtract: 0,
      reason: 'Structured provider results are sufficient without page extraction.',
    };
  }
}

export function createDefaultSearchReranker(options: DefaultSearchRerankerOptions = {}): SearchReranker {
  return {
    rerank({ request, contentPlan, results }) {
      return results
        .map((result, index) => ({
          ...result,
          score: scoreResult({ request, result, contentPlan, index, providerWeights: options.providerWeights ?? {} }),
        }))
        .sort((left, right) => right.score - left.score || left.rank - right.rank)
        .map((result, index) => ({ ...result, rank: index + 1 }));
    },
  };
}

export class CompositeSearchAgent {
  private readonly providers: SearchProviderAdapter[];
  private readonly crawler: SearchCrawler;
  private readonly reranker: SearchReranker;

  constructor(options: CompositeSearchAgentOptions) {
    this.providers = options.providers;
    this.crawler = options.crawler ?? new DefaultSearchCrawler();
    this.reranker = options.reranker ?? createDefaultSearchReranker();
  }

  async search(request: CompositeSearchRequest): Promise<CompositeSearchResult> {
    const normalizedRequest = normalizeRequest(request);
    const contentPlan = this.crawler.plan(normalizedRequest);
    const enabledProviders = this.providers.filter((provider) => provider.isEnabled?.(normalizedRequest) ?? true);
    if (enabledProviders.length === 0) {
      const errors = [{
        providerId: 'composite-search',
        message: 'No search providers are enabled for this request.',
        recoverable: true,
      }];
      return {
        status: 'unavailable',
        query: normalizedRequest.query,
        results: [],
        providerResults: [],
        errors,
        contentPlan,
      };
    }

    const providerResults = await Promise.all(enabledProviders.map((provider) => (
      runProvider(provider, normalizedRequest, contentPlan)
    )));
    const errors = providerResults.flatMap((providerResult) => providerResult.errors);
    const mergedResults = dedupeCompositeResults(providerResults.flatMap((providerResult) => providerResult.results));
    const reranked = this.reranker.rerank({
      request: normalizedRequest,
      contentPlan,
      results: mergedResults,
    }).slice(0, normalizedRequest.limit);
    return {
      status: reranked.length > 0
        ? 'found'
        : providerResults.some((providerResult) => providerResult.status === 'empty')
          ? 'empty'
          : 'unavailable',
      query: normalizedRequest.query,
      results: reranked,
      providerResults,
      errors,
      contentPlan,
    };
  }
}

export function compositeSearchResultToWebSearchResult(result: CompositeSearchResult): {
  status: 'found' | 'empty' | 'unavailable';
  query: string;
  results: Array<{ title: string; url: string; snippet: string }>;
  reason?: string;
} {
  return {
    status: result.status,
    query: result.query,
    results: result.results.map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.snippet,
    })),
    ...(result.errors.length > 0 ? { reason: uniqueStrings(result.errors.map((error) => error.message)).join(' ') } : {}),
  };
}

export function selectCompositeSearchAgentTools(descriptors: ToolDescriptor[], _goal: string): string[] {
  const desiredIds = [
    'webmcp:search_web',
    'webmcp:local_web_research',
    'webmcp:read_web_page',
  ];
  const seen = new Set<string>();
  const selected: string[] = [];
  for (const desiredId of desiredIds) {
    const descriptor = descriptors.find((candidate) => candidate.id === desiredId);
    if (descriptor && !isElicitationTool(descriptor) && !seen.has(descriptor.id)) {
      selected.push(descriptor.id);
      seen.add(descriptor.id);
    }
  }
  for (const descriptor of descriptors) {
    if (seen.has(descriptor.id) || descriptor.id === 'cli' || isElicitationTool(descriptor)) continue;
    if (/\b(search|crawl|crawler|research)\b/i.test(descriptorText(descriptor))) {
      selected.push(descriptor.id);
      seen.add(descriptor.id);
    }
  }
  return selected;
}

export function buildCompositeSearchAgentPrompt({
  task,
  descriptors,
  location,
}: {
  task: string;
  descriptors: ToolDescriptor[];
  location?: string;
}): string {
  const selectedToolIds = selectCompositeSearchAgentTools(descriptors, task);
  const toolCatalog = descriptors
    .filter((descriptor) => selectedToolIds.includes(descriptor.id))
    .map((descriptor) => `- ${descriptor.id}: ${descriptor.label} - ${descriptor.description}`)
    .join('\n');
  return [
    `Role: ${COMPOSITE_SEARCH_AGENT_ID} chat-agent`,
    'Mission: answer search-backed requests through one provider registry with source-backed evidence.',
    `User task: ${task}`,
    location ? `Resolved location: ${location}` : null,
    '',
    'provider registry:',
    toolCatalog || '- No search provider tools are currently enabled.',
    '',
    'Provider adapters:',
    '- webmcp:search_web is the public web provider.',
    '- webmcp:local_web_research is the local web research and crawler provider.',
    '- webmcp:read_web_page is the default content extraction reader for source pages.',
    '',
    'Operating policy:',
    '1. Run enabled providers as a composite search agent, then fan-in provider evidence before final answer selection.',
    '2. Use configurable providers, enabled providers, and provider weights instead of hard wiring one search path.',
    '3. Determine crawler depth before content extraction; read result pages when aggregate, local, ranked, or weak evidence needs validation.',
    '4. Apply dynamic reranking from the ranking goal, provider confidence, source-backed evidence, entity-specific links, and structured errors.',
    '5. Treat each recoverable provider error as structured evidence, continue with remaining providers, and surface failures without hiding them.',
    '6. HTML parsing belongs in registered providers; do not generate ad hoc shell HTML parsers.',
    '7. Reject page chrome, article metadata, generic categories, navigation labels, and non entity-specific links before answering.',
    '8. Return citations and concise source-backed answers from the reranked composite evidence.',
    '',
    'Quality bar: provider adapters, crawler depth, dynamic reranking, recoverable provider error handling, local web research fan-in, citations, and source-backed entity validation must all be visible in the trajectory.',
  ].filter((line): line is string => line !== null).join('\n');
}

export function evaluateCompositeSearchAgentPolicy({
  prompt,
  selectedToolIds,
}: {
  prompt: string;
  selectedToolIds: string[];
}): CompositeSearchAgentEvalResult {
  const checks = {
    usesProviderRegistry: /provider registry/i.test(prompt) && /Provider adapters/i.test(prompt),
    includesWebProvider: selectedToolIds.includes('webmcp:search_web') && /webmcp:search_web/.test(prompt),
    includesLocalResearchProvider: selectedToolIds.includes('webmcp:local_web_research') && /local web research/i.test(prompt),
    usesCrawlerDepth: /crawler depth/i.test(prompt) && /content extraction/i.test(prompt),
    usesDynamicReranking: /dynamic reranking/i.test(prompt) && /provider weights/i.test(prompt),
    avoidsGenericCliParsing: /HTML parsing belongs in registered providers/i.test(prompt)
      && !/node -e|generic CLI HTML parser/i.test(prompt),
  };
  const passedChecks = Object.values(checks).filter(Boolean).length;
  return {
    passed: passedChecks === Object.keys(checks).length,
    score: passedChecks / Object.keys(checks).length,
    checks,
  };
}

async function runProvider(
  provider: SearchProviderAdapter,
  request: CompositeSearchRequest,
  contentPlan: SearchContentPlan,
): Promise<NormalizedSearchProviderResult> {
  try {
    const result = await provider.search({ ...request, contentPlan });
    return normalizeProviderResult(provider, result, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      providerId: provider.id,
      providerLabel: provider.label,
      status: 'unavailable',
      query: request.query,
      results: [],
      errors: [{ providerId: provider.id, message, recoverable: true }],
    };
  }
}

function normalizeProviderResult(
  provider: SearchProviderAdapter,
  result: SearchProviderResult,
  request: CompositeSearchRequest,
): NormalizedSearchProviderResult {
  const errors = [
    ...(result.reason ? [{ providerId: provider.id, message: result.reason, recoverable: true }] : []),
    ...(result.errors ?? []).map((error) => ({ ...error, providerId: error.providerId || provider.id })),
  ];
  const results = result.results
    .map((item, index) => normalizeProviderItem(provider, item, index))
    .filter((item): item is CompositeSearchResultItem => Boolean(item));
  return {
    providerId: provider.id,
    providerLabel: provider.label,
    status: results.length > 0 && result.status === 'found' ? 'found' : result.status,
    query: result.query.trim() || request.query,
    results,
    errors,
  };
}

function normalizeProviderItem(
  provider: SearchProviderAdapter,
  item: SearchProviderResultItem,
  index: number,
): CompositeSearchResultItem | null {
  const title = item.title.trim();
  const url = item.url.trim();
  if (!title || !url) return null;
  return {
    title,
    url,
    snippet: item.snippet?.trim() ?? '',
    providerIds: [provider.id],
    providerLabels: [provider.label],
    rank: item.rank ?? index + 1,
    score: clamp01(item.score ?? 0.5),
    ...(item.metadata ? { metadata: { ...item.metadata } } : {}),
  };
}

function normalizeRequest(request: CompositeSearchRequest): CompositeSearchRequest {
  const query = request.query.trim().replace(/\s+/g, ' ') || request.question.trim().replace(/\s+/g, ' ');
  if (!query) {
    throw new TypeError('CompositeSearchAgent.search requires a query or question.');
  }
  return {
    ...request,
    question: request.question.trim().replace(/\s+/g, ' '),
    query,
    limit: Math.max(1, Math.min(25, Math.floor(request.limit || 5))),
  };
}

function dedupeCompositeResults(results: CompositeSearchResultItem[]): CompositeSearchResultItem[] {
  const merged = new Map<string, CompositeSearchResultItem>();
  for (const result of results) {
    const key = compositeResultKey(result);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, result);
      continue;
    }
    merged.set(key, {
      ...existing,
      snippet: uniqueStrings([existing.snippet, result.snippet].filter(Boolean)).join(' '),
      providerIds: uniqueStrings([...existing.providerIds, ...result.providerIds]),
      providerLabels: uniqueStrings([...existing.providerLabels, ...result.providerLabels]),
      score: Math.max(existing.score, result.score),
      metadata: { ...(existing.metadata ?? {}), ...(result.metadata ?? {}) },
    });
  }
  return [...merged.values()];
}

function compositeResultKey(result: CompositeSearchResultItem): string {
  return result.url
    ? normalizeUrlKey(result.url)
    : result.title.toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.searchParams.sort();
    return parsed.toString().replace(/\/$/u, '').toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/$/u, '');
  }
}

function scoreResult({
  request,
  result,
  contentPlan,
  index,
  providerWeights,
}: {
  request: CompositeSearchRequest;
  result: CompositeSearchResultItem;
  contentPlan: SearchContentPlan;
  index: number;
  providerWeights: Record<string, number>;
}): number {
  const queryTokens = tokenSet([request.query, request.subject ?? '', request.location ?? ''].join(' '));
  const resultTokens = tokenSet([result.title, result.snippet, result.url].join(' '));
  const overlap = queryTokens.size === 0
    ? 0
    : [...queryTokens].filter((token) => resultTokens.has(token)).length / queryTokens.size;
  const providerBoost = result.providerIds.reduce((sum, providerId) => sum + (providerWeights[providerId] ?? 0), 0);
  const crawlBoost = contentPlan.depth > 0 && result.metadata?.evidenceKind === 'crawled-page' ? 0.08 : 0;
  const rankPenalty = Math.min(0.2, (result.rank + index) * 0.01);
  return clamp01(result.score * 0.45 + overlap * 0.35 + providerBoost + crawlBoost - rankPenalty);
}

function tokenSet(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []);
}

function descriptorText(descriptor: ToolDescriptor): string {
  return [
    descriptor.id,
    descriptor.label,
    descriptor.description,
    descriptor.group,
    descriptor.subGroup ?? '',
    descriptor.subGroupLabel ?? '',
  ].join(' ');
}

function isElicitationTool(descriptor: ToolDescriptor): boolean {
  return /elicit|ask.+user|user input/i.test(descriptorText(descriptor));
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}
