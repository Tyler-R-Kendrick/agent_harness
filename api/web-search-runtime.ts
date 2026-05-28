import type { IncomingMessage, ServerResponse } from 'node:http';

export interface SearchWebRequest {
  query: string;
  limit: number;
}

export interface SearchWebResultItem {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchWebResult {
  status: 'found' | 'empty' | 'unavailable';
  query: string;
  results: SearchWebResultItem[];
  reason?: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type SearchBridgeEnv = Partial<Record<string, string | undefined>>;
type ConfiguredWebSearchProviderId = 'searxng' | 'perplexity' | 'tavily' | 'duckduckgo-instant';
type ConfiguredSearchProvider = {
  id: string;
  search: (request: { query: string; limit: number; signal?: AbortSignal }) => Promise<SearchWebResultItem[]>;
};
type RawSearchResult = {
  title?: string;
  url?: string;
  snippet?: string;
};

const SEARCH_PROVIDER_ATTEMPTS = 2;
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const CONFIGURED_WEB_SEARCH_PROVIDERS: readonly ConfiguredWebSearchProviderId[] = [
  'searxng',
  'perplexity',
  'tavily',
  'duckduckgo-instant',
];

export class WebSearchBridge {
  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    private readonly configuredProviders: ConfiguredSearchProvider[] = [],
  ) {}

  async search(request: SearchWebRequest): Promise<SearchWebResult> {
    const query = request.query.trim().replace(/\s+/g, ' ');
    const providers: Array<{
      url: string;
      parse: (html: string) => SearchWebResultItem[];
    }> = [
      {
        url: `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        parse: parseDuckDuckGoHtml,
      },
      {
        url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
        parse: parseBingHtml,
      },
    ];
    const reasons: string[] = [];
    try {
      for (const provider of this.configuredProviders) {
        for (let attempt = 1; attempt <= SEARCH_PROVIDER_ATTEMPTS; attempt += 1) {
          try {
            const results = (await provider.search({ query, limit: request.limit })).slice(0, request.limit);
            if (results.length > 0) {
              return { status: 'found', query, results };
            }
            reasons.push(`${provider.id} returned no search results.`);
            break;
          } catch (error) {
            reasons.push(error instanceof Error ? error.message : String(error));
            await retryDelay(attempt);
          }
        }
      }
      for (const provider of providers) {
        for (let attempt = 1; attempt <= SEARCH_PROVIDER_ATTEMPTS; attempt += 1) {
          let response: Response;
          try {
            response = await fetchWithTimeout(this.fetchImpl, provider.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; agent-browser/0.1; +https://localhost)',
                Accept: 'text/html,application/xhtml+xml',
              },
            }, this.timeoutMs);
          } catch (error) {
            reasons.push(error instanceof Error ? error.message : String(error));
            await retryDelay(attempt);
            continue;
          }
          if (!response.ok) {
            reasons.push(`Search provider returned ${response.status}.`);
            await retryDelay(attempt);
            continue;
          }
          const results = provider.parse(await response.text()).slice(0, request.limit);
          if (results.length > 0) {
            return { status: 'found', query, results };
          }
          reasons.push('No search results found.');
          break;
        }
      }
      const uniqueReasons = [...new Set(reasons)];
      return {
        status: uniqueReasons.some((reason) => /provider returned|fetch failed|network|blocked|timed?\s*out|timeout/i.test(reason)) ? 'unavailable' : 'empty',
        query,
        results: [],
        reason: uniqueReasons.join(' '),
      };
    } catch (error) {
      return {
        status: 'unavailable',
        query,
        reason: error instanceof Error ? error.message : String(error),
        results: [],
      };
    }
  }
}

export function createConfiguredWebSearchBridge(
  env: SearchBridgeEnv = typeof process === 'undefined' ? {} : process.env,
  fetchImpl: FetchLike = fetch,
  timeoutMs = readSearchTimeoutMs(env),
): WebSearchBridge {
  return new WebSearchBridge(fetchImpl, timeoutMs, createConfiguredSearchProviders(env, fetchImpl, timeoutMs));
}

function createConfiguredSearchProviders(
  env: SearchBridgeEnv,
  fetchImpl: FetchLike,
  timeoutMs: number,
): ConfiguredSearchProvider[] {
  return configuredProviderNames(env)
    .map((name) => createConfiguredSearchProvider(name, env, fetchImpl, timeoutMs));
}

function configuredProviderNames(env: SearchBridgeEnv): ConfiguredWebSearchProviderId[] {
  const configured = (env.AGENT_BROWSER_WEB_SEARCH_PROVIDERS ?? env.AGENT_BROWSER_WEB_SEARCH_PROVIDER ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is ConfiguredWebSearchProviderId => (
      CONFIGURED_WEB_SEARCH_PROVIDERS.includes(entry as ConfiguredWebSearchProviderId)
    ));
  if (configured.length > 0) return uniqueProviderNames(configured);

  const inferred: ConfiguredWebSearchProviderId[] = [];
  if (env.AGENT_BROWSER_SEARXNG_BASE_URL || env.SEARXNG_BASE_URL) inferred.push('searxng');
  if (env.AGENT_BROWSER_TAVILY_API_KEY || env.TAVILY_API_KEY) inferred.push('tavily');
  if (env.AGENT_BROWSER_PERPLEXITY_API_KEY || env.PERPLEXITY_API_KEY) inferred.push('perplexity');
  inferred.push('duckduckgo-instant');
  return inferred;
}

function createResearchSearchProvider(
  name: ConfiguredWebSearchProviderId,
  env: SearchBridgeEnv,
  fetchImpl: FetchLike,
  timeoutMs: number,
): ConfiguredSearchProvider {
  switch (name) {
    case 'searxng':
      return createSearxngSearchProvider(env, fetchImpl, timeoutMs);
    case 'perplexity':
      return createPerplexitySearchProvider(env, fetchImpl, timeoutMs);
    case 'tavily':
      return createTavilySearchProvider(env, fetchImpl, timeoutMs);
    case 'duckduckgo-instant':
      return createDuckDuckGoInstantSearchProvider(fetchImpl, timeoutMs);
    default:
      return assertNeverSearchProvider(name);
  }
}

const createConfiguredSearchProvider = createResearchSearchProvider;

function createSearxngSearchProvider(
  env: SearchBridgeEnv,
  fetchImpl: FetchLike,
  timeoutMs: number,
): ConfiguredSearchProvider {
  const baseUrl = env.AGENT_BROWSER_SEARXNG_BASE_URL ?? env.SEARXNG_BASE_URL ?? 'http://localhost:8080';
  return {
    id: 'searxng',
    async search({ query, limit, signal }) {
      const url = new URL('/search', baseUrl);
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('categories', 'general');
      const response = await fetchWithTimeout(fetchImpl, url.toString(), {
        headers: { Accept: 'application/json' },
        signal,
      }, timeoutMs);
      if (!response.ok) {
        throw new Error(`SearXNG returned HTTP ${response.status} ${response.statusText}`.trim());
      }
      const parsed = await response.json() as {
        results?: Array<{ title?: string; url?: string; content?: string }>;
      };
      return normalizeSearchItems((parsed.results ?? []).map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.content,
      })), limit);
    },
  };
}

function createPerplexitySearchProvider(
  env: SearchBridgeEnv,
  fetchImpl: FetchLike,
  timeoutMs: number,
): ConfiguredSearchProvider {
  const apiKey = env.AGENT_BROWSER_PERPLEXITY_API_KEY ?? env.PERPLEXITY_API_KEY;
  return {
    id: 'perplexity',
    async search({ query, limit, signal }) {
      if (!apiKey) throw new TypeError('PerplexitySearchProvider requires an apiKey.');
      const response = await fetchWithTimeout(fetchImpl, 'https://api.perplexity.ai/search', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, max_results: limit }),
        signal,
      }, timeoutMs);
      if (!response.ok) {
        throw new Error(`Perplexity search returned HTTP ${response.status} ${response.statusText}`.trim());
      }
      const parsed = await response.json() as {
        results?: Array<{ title?: string; url?: string; snippet?: string }>;
      };
      return normalizeSearchItems((parsed.results ?? []).map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
      })), limit);
    },
  };
}

function createTavilySearchProvider(
  env: SearchBridgeEnv,
  fetchImpl: FetchLike,
  timeoutMs: number,
): ConfiguredSearchProvider {
  const apiKey = env.AGENT_BROWSER_TAVILY_API_KEY ?? env.TAVILY_API_KEY;
  return {
    id: 'tavily',
    async search({ query, limit, signal }) {
      if (!apiKey) throw new TypeError('TavilySearchProvider requires an apiKey.');
      const response = await fetchWithTimeout(fetchImpl, 'https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: limit,
          search_depth: 'basic',
          include_answer: false,
          include_raw_content: false,
        }),
        signal,
      }, timeoutMs);
      if (!response.ok) {
        throw new Error(`Tavily search returned HTTP ${response.status} ${response.statusText}`.trim());
      }
      const parsed = await response.json() as {
        results?: Array<{ title?: string; url?: string; content?: string; raw_content?: string }>;
      };
      return normalizeSearchItems((parsed.results ?? []).map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.content ?? item.raw_content,
      })), limit);
    },
  };
}

function createDuckDuckGoInstantSearchProvider(
  fetchImpl: FetchLike,
  timeoutMs: number,
): ConfiguredSearchProvider {
  return {
    id: 'duckduckgo-instant',
    async search({ query, limit, signal }) {
      const url = new URL('/', 'https://api.duckduckgo.com/');
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('no_html', '1');
      url.searchParams.set('skip_disambig', '1');
      url.searchParams.set('no_redirect', '1');
      const response = await fetchWithTimeout(fetchImpl, url.toString(), {
        headers: { Accept: 'application/json' },
        signal,
      }, timeoutMs);
      if (!response.ok) {
        throw new Error(`DuckDuckGo Instant Answer API returned HTTP ${response.status} ${response.statusText}`.trim());
      }
      const parsed = await response.json() as {
        Heading?: string;
        AbstractText?: string;
        AbstractURL?: string;
        Results?: Array<{ Text?: string; FirstURL?: string }>;
        RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
      };
      return normalizeSearchItems(readDuckDuckGoInstantResults(parsed), limit);
    },
  };
}

function readDuckDuckGoInstantResults(parsed: {
  Heading?: string;
  AbstractText?: string;
  AbstractURL?: string;
  Results?: Array<{ Text?: string; FirstURL?: string }>;
  RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
}): RawSearchResult[] {
  const results: RawSearchResult[] = [];
  if (parsed.AbstractURL && (parsed.Heading || parsed.AbstractText)) {
    results.push({
      title: parsed.Heading || titleFromText(parsed.AbstractText ?? ''),
      url: parsed.AbstractURL,
      snippet: parsed.AbstractText,
    });
  }
  for (const topic of parsed.Results ?? []) {
    if (topic.FirstURL && topic.Text) {
      results.push({ title: titleFromText(topic.Text), url: topic.FirstURL, snippet: topic.Text });
    }
  }
  for (const topic of parsed.RelatedTopics ?? []) {
    const nestedTopics = Array.isArray(topic.Topics) ? topic.Topics : [topic];
    for (const nested of nestedTopics) {
      if (nested.FirstURL && nested.Text) {
        results.push({ title: titleFromText(nested.Text), url: nested.FirstURL, snippet: nested.Text });
      }
    }
  }
  return results;
}

function normalizeSearchItems(items: RawSearchResult[], limit: number): SearchWebResultItem[] {
  const results: SearchWebResultItem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const title = decodeHtml(String(item.title ?? '')).trim();
    const url = String(item.url ?? '').trim();
    if (!title || !/^https?:\/\//i.test(url)) continue;
    const key = `${title.toLocaleLowerCase()}\u0000${url.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      title,
      url,
      snippet: decodeHtml(String(item.snippet ?? '')).trim(),
    });
    if (results.length >= limit) break;
  }
  return results;
}

function titleFromText(text: string): string {
  const [prefix] = text.split(/\s[-:]\s/, 1);
  const title = prefix?.trim() || text.trim();
  return title.length > 120 ? `${title.slice(0, 117)}...` : title;
}

function uniqueProviderNames(names: ConfiguredWebSearchProviderId[]): ConfiguredWebSearchProviderId[] {
  return names.filter((name, index) => names.indexOf(name) === index);
}

function readSearchTimeoutMs(env: SearchBridgeEnv): number {
  const raw = env.AGENT_BROWSER_WEB_SEARCH_TIMEOUT_MS ?? env.SEARCH_TIMEOUT_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_FETCH_TIMEOUT_MS;
}

function assertNeverSearchProvider(value: never): never {
  throw new TypeError(`Unsupported web search provider: ${String(value)}`);
}

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetchImpl(input, { ...init, signal: controller.signal }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error(`Fetch timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function parseDuckDuckGoHtml(html: string): SearchWebResultItem[] {
  const results: SearchWebResultItem[] = [];
  const linkPattern = /<a\b[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const rawUrl = match[1] ?? '';
    const rawTitle = match[2] ?? '';
    const url = normalizeUrl(resolveProviderUrl(rawUrl, 'https://duckduckgo.com'));
    const title = decodeHtml(stripTags(rawTitle));
    if (!title || !url) continue;
    const snippet = decodeHtml(readNearestSnippet(html, match.index ?? 0));
    results.push({ title, url, snippet });
  }
  return results;
}

function parseBingHtml(html: string): SearchWebResultItem[] {
  const results: SearchWebResultItem[] = [];
  const blockPattern = /<li\b[^>]*class=["'][^"']*b_algo[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
  for (const blockMatch of html.matchAll(blockPattern)) {
    const block = blockMatch[1] ?? '';
    const link = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(block);
    if (!link) continue;
    const rawUrl = link[1] ?? '';
    const rawTitle = link[2] ?? '';
    const url = normalizeUrl(resolveProviderUrl(rawUrl, 'https://www.bing.com'));
    const title = decodeHtml(stripTags(rawTitle));
    const snippet = decodeHtml(stripTags(/<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(block)?.[1] ?? ''));
    if (title && url) results.push({ title, url, snippet });
  }
  return results;
}

function readNearestSnippet(html: string, index: number): string {
  const window = html.slice(index, index + 1600);
  const match = /<a\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>|<div\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(window);
  return stripTags(match?.[1] ?? match?.[2] ?? '');
}

function resolveProviderUrl(value: string, baseUrl: string): string {
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : value;
  } catch {
    return value;
  }
}

function normalizeUrl(url: string): string {
  const duckDuckGoUrl = decodeDuckDuckGoRedirect(url);
  if (duckDuckGoUrl) return duckDuckGoUrl;
  const bingUrl = decodeBingRedirect(url);
  if (bingUrl) return bingUrl;
  return url;
}

function decodeDuckDuckGoRedirect(url: string): string | null {
  if (!url.includes('uddg=')) return null;
  try {
    const parsed = new URL(url, 'https://duckduckgo.com');
    const target = parsed.searchParams.get('uddg');
    return target ? decodeURIComponent(target) : null;
  } catch {
    return null;
  }
}

function decodeBingRedirect(url: string): string | null {
  if (!/https?:\/\/(?:www\.)?bing\.com\/ck\/a/i.test(url) && !url.includes('bing.com/ck/a')) {
    return null;
  }
  try {
    const parsed = new URL(url, 'https://www.bing.com');
    const encoded = parsed.searchParams.get('u');
    if (!encoded) return null;
    return decodeBingEncodedUrl(encoded);
  } catch {
    return null;
  }
}

function decodeBingEncodedUrl(encoded: string): string | null {
  const candidates = [encoded, encoded.startsWith('a1') ? encoded.slice(2) : encoded];
  for (const candidate of candidates) {
    try {
      const normalized = candidate.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = Buffer.from(normalized, 'base64').toString('utf8');
      if (/^https?:\/\//i.test(decoded)) return decoded;
    } catch {
      // Try the next encoding shape.
    }
  }
  try {
    const decoded = decodeURIComponent(encoded);
    return /^https?:\/\//i.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

function decodeHtml(value: string): string {
  return value
    .replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, code: string) => {
      const normalized = code.toLowerCase();
      if (normalized === 'amp') return '&';
      if (normalized === 'quot') return '"';
      if (normalized === 'apos') return "'";
      if (normalized === 'lt') return '<';
      if (normalized === 'gt') return '>';
      if (normalized === 'nbsp') return ' ';
      if (normalized.startsWith('#x')) return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
      if (normalized.startsWith('#')) return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
      return entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function retryDelay(attempt: number): Promise<void> {
  if (attempt >= SEARCH_PROVIDER_ATTEMPTS) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, 150 * attempt));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readLimit(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(10, Math.floor(parsed))
    : 5;
}

function requestUrl(rawUrl: string | undefined): URL {
  return new URL(rawUrl || '/', 'http://localhost');
}

async function readSearchRequest(req: IncomingMessage): Promise<SearchWebRequest> {
  const url = requestUrl(req.url);
  if (req.method === 'GET') {
    return {
      query: (url.searchParams.get('query') ?? '').trim().replace(/\s+/g, ' '),
      limit: readLimit(url.searchParams.get('limit')),
    };
  }
  const body = await readJsonBody(req);
  return {
    query: typeof (body as { query?: unknown }).query === 'string'
      ? (body as { query: string }).query.trim().replace(/\s+/g, ' ')
      : '',
    limit: readLimit((body as { limit?: unknown }).limit),
  };
}

const bridge = createConfiguredWebSearchBridge();

export function createSearchApiMiddleware(searchBridge: WebSearchBridge = bridge) {
  return async (req: IncomingMessage, res: ServerResponse, next: (error?: Error) => void) => {
    if (requestUrl(req.url).pathname !== '/api/web-search') {
      next();
      return;
    }
    try {
      if (req.method !== 'POST' && req.method !== 'GET') {
        writeJson(res, 405, { error: 'Method not allowed.' });
        return;
      }
      const searchRequest = await readSearchRequest(req);
      if (!searchRequest.query) {
        writeJson(res, 400, { error: 'query is required.' });
        return;
      }
      writeJson(res, 200, await searchBridge.search(searchRequest));
    } catch (error) {
      next(error instanceof Error ? error : new Error('Web search middleware failed.'));
    }
  };
}
