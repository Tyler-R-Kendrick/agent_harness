import { stableHash } from './hash';
import { normalizeUrl } from './normalizeUrl';
import { assertPublicHttpUrl } from './ssrfGuard';
import { withTimeout } from './timeout';
import type { ExtractedPage, Extractor } from './types';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class FetchPageExtractor implements Extractor {
  private readonly allowPrivateUrlExtraction: boolean;
  private readonly fetchImpl: FetchLike;

  constructor(options: {
    allowPrivateUrlExtraction?: boolean;
    fetchImpl?: FetchLike;
  } = {}) {
    this.allowPrivateUrlExtraction = options.allowPrivateUrlExtraction ?? false;
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  async extract(request: {
    url: string;
    sourceResultId?: string;
    timeoutMs: number;
    signal?: AbortSignal;
  }): Promise<ExtractedPage> {
    await assertPublicHttpUrl(request.url, {
      allowPrivateUrlExtraction: this.allowPrivateUrlExtraction,
    });
    const response = await withTimeout(
      (signal) => this.fetchImpl(request.url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1',
        },
        signal,
      }),
      request.timeoutMs,
      request.signal,
    );
    if (!response.ok) {
      throw new Error(`Page extraction returned HTTP ${response.status} ${response.statusText}`.trim());
    }
    const html = await response.text();
    const finalUrl = response.url || request.url;
    const text = htmlToText(html);
    if (text.length < 200) {
      throw new Error('Extracted page text is too short to use as evidence.');
    }
    const normalizedUrl = normalizeUrl(finalUrl);
    return {
      id: `page-${stableHash(normalizedUrl)}`,
      url: request.url,
      finalUrl,
      normalizedUrl,
      title: extractTitle(html),
      excerpt: text.slice(0, 280),
      text,
      length: text.length,
      fetchedAt: new Date().toISOString(),
      ...(request.sourceResultId ? { sourceResultId: request.sourceResultId } : {}),
    };
  }
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(stripTags(match[1]).trim()) : undefined;
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(stripTags(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(?:p|br|li|h[1-6]|section|article|div)\b[^>]*>/gi, '\n'),
  ))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

function decodeHtmlEntities(value: string): string {
  const textarea = globalThis.document?.createElement('textarea');
  if (!textarea) return value;
  textarea.innerHTML = value;
  return textarea.value;
}
