import { stableHash } from './hash';
import { normalizeUrl } from './normalizeUrl';
import type { WebSearchProviderId, WebSearchResult } from './types';

export type RawSearchResult = {
  title?: string | null;
  url?: string | null;
  snippet?: string | null;
  provider: WebSearchProviderId;
  engine?: string | null;
  score?: number | null;
  publishedDate?: string | null;
  metadata?: Record<string, unknown>;
};

export function normalizeSearchResults(items: RawSearchResult[], maxResults: number): WebSearchResult[] {
  const seen = new Set<string>();
  const results: WebSearchResult[] = [];
  for (const item of items) {
    const title = item.title?.trim();
    const url = item.url?.trim();
    if (!title || !url) continue;

    const normalizedUrl = normalizeUrl(url);
    if (seen.has(normalizedUrl)) continue;
    seen.add(normalizedUrl);

    results.push({
      id: `search-${stableHash(normalizedUrl)}`,
      title,
      url,
      normalizedUrl,
      ...(item.snippet?.trim() ? { snippet: item.snippet.trim() } : {}),
      provider: item.provider,
      ...(item.engine?.trim() ? { engine: item.engine.trim() } : {}),
      ...(typeof item.score === 'number' ? { score: item.score } : {}),
      rank: results.length + 1,
      ...(item.publishedDate?.trim() ? { publishedDate: item.publishedDate.trim() } : {}),
      ...(item.metadata ? { metadata: item.metadata } : {}),
    });

    if (results.length >= maxResults) break;
  }
  return results;
}
