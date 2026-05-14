import { normalizeSearchResults } from './searchResultNormalizer';
import { SearxngSearchProvider } from './searxng';
import { withTimeout } from './timeout';
import type { RawSearchResult } from './searchResultNormalizer';
import type {
  FetchLike,
  SearchProvider,
  SecretRefResolver,
  WebResearchAgentConfig,
  WebSearchResult,
} from './types';

type SearchRequest = Parameters<SearchProvider['search']>[0];

type PerplexitySearchCreateParams = {
  query: string | string[];
  max_results?: number;
  max_tokens_per_page?: number;
  search_language_filter?: string[];
  search_recency_filter?: 'day' | 'week' | 'month' | 'year';
};

type PerplexitySearchResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    snippet?: string;
    date?: string | null;
    last_updated?: string | null;
  }>;
};

type PerplexitySearchClient = {
  search: {
    create(params: PerplexitySearchCreateParams): Promise<PerplexitySearchResponse>;
  };
};

type PerplexityClientFactoryOptions = {
  apiKey: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
};

export type PerplexityClientFactory = (
  options: PerplexityClientFactoryOptions,
) => PerplexitySearchClient | Promise<PerplexitySearchClient>;

type TavilySearchOptions = {
  searchDepth?: 'basic' | 'advanced' | 'fast' | 'ultra-fast';
  topic?: 'general' | 'news' | 'finance';
  days?: number;
  maxResults?: number;
  includeAnswer?: boolean;
  includeRawContent?: false | 'text' | 'markdown';
};

type TavilySearchResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    rawContent?: string;
    score?: number;
    publishedDate?: string;
  }>;
};

type TavilySearchClient = {
  search(query: string, options?: TavilySearchOptions): Promise<TavilySearchResponse>;
};

type TavilyClientFactoryOptions = {
  apiKey: string;
};

export type TavilyClientFactory = (
  options: TavilyClientFactoryOptions,
) => TavilySearchClient | Promise<TavilySearchClient>;

type DuckDuckGoResponse = {
  Heading?: string;
  AbstractText?: string;
  AbstractURL?: string;
  Results?: DuckDuckGoTopic[];
  RelatedTopics?: Array<DuckDuckGoTopic | DuckDuckGoTopicGroup>;
};

type DuckDuckGoTopic = {
  Text?: string;
  FirstURL?: string;
};

type DuckDuckGoTopicGroup = {
  Name?: string;
  Topics?: DuckDuckGoTopic[];
};

type SdkSearchProviderOptions = {
  apiKey?: string;
  resolveSecretRefs?: SecretRefResolver;
};

const SECRET_REF_PREFIX = 'secret-ref://local/';

export class PerplexitySearchProvider implements SearchProvider {
  readonly id = 'perplexity';

  private readonly apiKey?: string;
  private readonly timeoutMs?: number;
  private readonly maxTokensPerPage?: number;
  private readonly fetchImpl?: FetchLike;
  private readonly resolveSecretRefs?: SecretRefResolver;
  private readonly clientFactory: PerplexityClientFactory;

  constructor(options: SdkSearchProviderOptions & {
    timeoutMs?: number;
    maxTokensPerPage?: number;
    fetchImpl?: FetchLike;
    clientFactory?: PerplexityClientFactory;
  } = {}) {
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs;
    this.maxTokensPerPage = options.maxTokensPerPage;
    this.fetchImpl = options.fetchImpl;
    this.resolveSecretRefs = options.resolveSecretRefs;
    this.clientFactory = options.clientFactory ?? createPerplexityClient;
  }

  async search(request: SearchRequest): Promise<WebSearchResult[]> {
    const client = await this.createClient();
    const response = await client.search.create({
      query: request.query,
      max_results: request.maxResults,
      ...(this.maxTokensPerPage !== undefined ? { max_tokens_per_page: this.maxTokensPerPage } : {}),
      ...(request.language ? { search_language_filter: [request.language] } : {}),
      ...(request.freshness && request.freshness !== 'any' ? { search_recency_filter: request.freshness } : {}),
    });

    return normalizeSearchResults((response.results ?? []).map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.snippet,
      provider: 'perplexity',
      publishedDate: item.date ?? item.last_updated,
    })), request.maxResults);
  }

  private async createClient(): Promise<PerplexitySearchClient> {
    const apiKey = await resolveApiKey({
      apiKey: this.apiKey,
      providerName: 'PerplexitySearchProvider',
      resolveSecretRefs: this.resolveSecretRefs,
    });
    const options: PerplexityClientFactoryOptions = { apiKey };
    if (this.timeoutMs !== undefined) options.timeoutMs = this.timeoutMs;
    if (this.fetchImpl) options.fetchImpl = this.fetchImpl;
    return this.clientFactory(options);
  }
}

export class TavilySearchProvider implements SearchProvider {
  readonly id = 'tavily';

  private readonly apiKey?: string;
  private readonly resolveSecretRefs?: SecretRefResolver;
  private readonly clientFactory: TavilyClientFactory;

  constructor(options: SdkSearchProviderOptions & {
    clientFactory?: TavilyClientFactory;
  } = {}) {
    this.apiKey = options.apiKey;
    this.resolveSecretRefs = options.resolveSecretRefs;
    this.clientFactory = options.clientFactory ?? createTavilyClient;
  }

  async search(request: SearchRequest): Promise<WebSearchResult[]> {
    const client = await this.createClient();
    const days = freshnessToDays(request.freshness);
    const response = await client.search(request.query, {
      maxResults: request.maxResults,
      searchDepth: 'basic',
      includeAnswer: false,
      includeRawContent: false,
      ...(days !== undefined ? { days } : {}),
    });

    return normalizeSearchResults((response.results ?? []).map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.content ?? item.rawContent,
      provider: 'tavily',
      score: item.score,
      publishedDate: item.publishedDate,
    })), request.maxResults);
  }

  private async createClient(): Promise<TavilySearchClient> {
    const apiKey = await resolveApiKey({
      apiKey: this.apiKey,
      providerName: 'TavilySearchProvider',
      resolveSecretRefs: this.resolveSecretRefs,
    });
    return this.clientFactory({ apiKey });
  }
}

export class DuckDuckGoInstantSearchProvider implements SearchProvider {
  readonly id = 'duckduckgo-instant';

  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: {
    baseUrl?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
  } = {}) {
    this.baseUrl = options.baseUrl ?? 'https://api.duckduckgo.com/';
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  async search(request: SearchRequest): Promise<WebSearchResult[]> {
    const url = new URL('/', this.baseUrl);
    url.searchParams.set('q', request.query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('no_html', '1');
    url.searchParams.set('skip_disambig', '1');
    url.searchParams.set('no_redirect', '1');

    const response = await withTimeout(
      (signal) => this.fetchImpl(url, { headers: { Accept: 'application/json' }, signal }),
      this.timeoutMs,
      request.signal,
    );
    if (!response.ok) {
      throw new Error(`DuckDuckGo Instant Answer API returned HTTP ${response.status} ${response.statusText}`.trim());
    }

    const parsed = await response.json() as DuckDuckGoResponse;
    return normalizeSearchResults(duckDuckGoResults(parsed), request.maxResults);
  }
}

export function createSearchProviderFromConfig(config: WebResearchAgentConfig = {}): SearchProvider {
  const providerName = config.searchProviderName ?? 'searxng';
  switch (providerName) {
    case 'searxng':
      return new SearxngSearchProvider({
        baseUrl: config.searxngBaseUrl,
        timeoutMs: config.searchTimeoutMs,
      });
    case 'perplexity':
      return new PerplexitySearchProvider({
        apiKey: config.perplexityApiKey,
        timeoutMs: config.searchTimeoutMs,
        resolveSecretRefs: config.resolveSecretRefs,
      });
    case 'tavily':
      return new TavilySearchProvider({
        apiKey: config.tavilyApiKey,
        resolveSecretRefs: config.resolveSecretRefs,
      });
    case 'duckduckgo-instant':
      return new DuckDuckGoInstantSearchProvider({
        timeoutMs: config.searchTimeoutMs,
      });
    default:
      return assertNeverProvider(providerName);
  }
}

export { SearxngSearchProvider };

async function createPerplexityClient({
  apiKey,
  timeoutMs,
  fetchImpl,
}: PerplexityClientFactoryOptions): Promise<PerplexitySearchClient> {
  let PerplexityCtor: new (options: {
    apiKey: string;
    timeout?: number;
    fetch?: never;
  }) => PerplexitySearchClient;
  try {
    ({ Perplexity: PerplexityCtor } = await import('@perplexity-ai/perplexity_ai'));
  } catch {
    throw new Error('Perplexity SDK is not installed. Install "@perplexity-ai/perplexity_ai" to use the PerplexitySearchProvider.');
  }
  return new PerplexityCtor({
    apiKey,
    ...(timeoutMs !== undefined ? { timeout: timeoutMs } : {}),
    ...(fetchImpl ? { fetch: fetchImpl as never } : {}),
  });
}

async function createTavilyClient({ apiKey }: TavilyClientFactoryOptions): Promise<TavilySearchClient> {
  const { tavily } = await import('@tavily/core');
  return tavily({ apiKey }) as TavilySearchClient;
}

async function resolveApiKey({
  apiKey,
  providerName,
  resolveSecretRefs,
}: {
  apiKey?: string;
  providerName: string;
  resolveSecretRefs?: SecretRefResolver;
}): Promise<string> {
  const resolved = resolveSecretRefs ? await resolveSecretRefs(apiKey ?? '') : apiKey;
  const key = typeof resolved === 'string' ? resolved.trim() : '';
  if (!key) {
    throw new TypeError(`${providerName} requires an apiKey.`);
  }
  if (key.startsWith(SECRET_REF_PREFIX)) {
    throw new TypeError(`${providerName} received an unresolved secretRef. Pass resolveSecretRefs or resolve tool arguments before search.`);
  }
  return key;
}

function freshnessToDays(freshness: SearchRequest['freshness']): number | undefined {
  switch (freshness) {
    case 'day':
      return 1;
    case 'week':
      return 7;
    case 'month':
      return 31;
    case 'year':
      return 365;
    default:
      return undefined;
  }
}

function duckDuckGoResults(parsed: DuckDuckGoResponse): RawSearchResult[] {
  const results: RawSearchResult[] = [];
  if (parsed.AbstractURL && (parsed.Heading || parsed.AbstractText)) {
    results.push({
      title: parsed.Heading || titleFromDuckDuckGoText(parsed.AbstractText ?? ''),
      url: parsed.AbstractURL,
      snippet: parsed.AbstractText,
      provider: 'duckduckgo-instant' as const,
      metadata: { source: 'abstract' },
    });
  }

  for (const topic of parsed.Results ?? []) {
    results.push(...duckDuckGoTopicResults(topic));
  }
  for (const topic of parsed.RelatedTopics ?? []) {
    if (isDuckDuckGoTopicGroup(topic)) {
      for (const nested of topic.Topics ?? []) {
        results.push(...duckDuckGoTopicResults(nested));
      }
    } else {
      results.push(...duckDuckGoTopicResults(topic));
    }
  }

  return results;
}

function duckDuckGoTopicResults(topic: DuckDuckGoTopic): RawSearchResult[] {
  if (!topic.FirstURL || !topic.Text) return [];
  return [{
    title: titleFromDuckDuckGoText(topic.Text),
    url: topic.FirstURL,
    snippet: topic.Text,
    provider: 'duckduckgo-instant' as const,
    metadata: { source: 'topic' },
  }];
}

function isDuckDuckGoTopicGroup(topic: DuckDuckGoTopic | DuckDuckGoTopicGroup): topic is DuckDuckGoTopicGroup {
  return Array.isArray((topic as DuckDuckGoTopicGroup).Topics);
}

function titleFromDuckDuckGoText(text: string): string {
  const [prefix] = text.split(/\s[-:]\s/, 1);
  const title = prefix?.trim() || text.trim();
  return title.length > 120 ? `${title.slice(0, 117)}...` : title;
}

function assertNeverProvider(value: never): never {
  throw new TypeError(`Unsupported search provider: ${String(value)}`);
}
