import { stableHash } from './hash';
import { normalizeUrl } from './normalizeUrl';
import { withTimeout } from './timeout';
import type { SearchProvider, WebSearchResult } from './types';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type SearxngResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    engine?: string;
    score?: number;
    publishedDate?: string;
  }>;
};

export class SearxngSearchProvider implements SearchProvider {
  readonly id = 'searxng';

  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: {
    baseUrl?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
  } = {}) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:8080';
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  async search(request: {
    query: string;
    maxResults: number;
    language?: string;
    freshness?: 'any' | 'day' | 'week' | 'month' | 'year';
    safeSearch?: boolean;
    signal?: AbortSignal;
  }): Promise<WebSearchResult[]> {
    const url = new URL('/search', this.baseUrl);
    url.searchParams.set('q', request.query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('categories', 'general');
    if (request.language) url.searchParams.set('language', request.language);
    if (request.safeSearch !== undefined) url.searchParams.set('safesearch', request.safeSearch ? '1' : '0');
    if (request.freshness && request.freshness !== 'any') url.searchParams.set('time_range', request.freshness);

    const response = await withTimeout(
      (signal) => this.fetchImpl(url, { headers: { Accept: 'application/json' }, signal }),
      this.timeoutMs,
      request.signal,
    );
    if (!response.ok) {
      throw new Error(`SearXNG returned HTTP ${response.status} ${response.statusText}`.trim());
    }

    const parsed = await response.json() as SearxngResponse;
    const seen = new Set<string>();
    const results: WebSearchResult[] = [];
    for (const item of parsed.results ?? []) {
      if (!item.title || !item.url) continue;
      const normalizedUrl = normalizeUrl(item.url);
      if (seen.has(normalizedUrl)) continue;
      seen.add(normalizedUrl);
      results.push({
        id: `search-${stableHash(normalizedUrl)}`,
        title: item.title.trim(),
        url: item.url.trim(),
        normalizedUrl,
        ...(item.content ? { snippet: item.content.trim() } : {}),
        provider: 'searxng',
        ...(item.engine ? { engine: item.engine } : {}),
        ...(typeof item.score === 'number' ? { score: item.score } : {}),
        rank: results.length + 1,
        ...(item.publishedDate ? { publishedDate: item.publishedDate } : {}),
      });
      if (results.length >= request.maxResults) break;
    }
    return results;
  }
}
