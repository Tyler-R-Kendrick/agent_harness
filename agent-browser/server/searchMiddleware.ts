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

export interface ReadWebPageRequest {
  url: string;
}

export interface WebPageLink {
  text: string;
  url: string;
}

export interface WebPageEntity {
  name: string;
  url?: string;
  evidence: string;
}

export interface WebPageObservation {
  kind: 'json-ld' | 'page-link' | 'heading' | 'text-span';
  label: string;
  url?: string;
  evidence: string;
  localContext?: string;
  sourceUrl: string;
}

export interface ReadWebPageResult {
  status: 'read' | 'unavailable' | 'blocked';
  url: string;
  title?: string;
  text?: string;
  links: WebPageLink[];
  jsonLd: unknown[];
  entities: WebPageEntity[];
  observations?: WebPageObservation[];
  reason?: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const SEARCH_PROVIDER_ATTEMPTS = 2;
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export class WebSearchBridge {
  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
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

const bridge = new WebSearchBridge();

export class WebPageBridge {
  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
  ) {}

  async read(request: ReadWebPageRequest): Promise<ReadWebPageResult> {
    const normalizedUrl = normalizeUrl(request.url.trim());
    const url = safeHttpUrl(normalizedUrl);
    if (!url) {
      return {
        status: 'blocked',
        url: normalizedUrl,
        reason: 'Only http and https URLs can be read.',
        links: [],
        jsonLd: [],
        entities: [],
        observations: [],
      };
    }

    try {
      const response = await fetchWithTimeout(this.fetchImpl, url.toString(), {
        headers: {
          'User-Agent': 'agent-browser/0.1 (+https://localhost)',
          Accept: 'text/html,application/xhtml+xml,text/plain',
        },
      }, this.timeoutMs);
      if (!response.ok) {
        return {
          status: 'unavailable',
          url: url.toString(),
          reason: `Web page provider returned ${response.status}.`,
          links: [],
          jsonLd: [],
          entities: [],
          observations: [],
        };
      }
      const html = await response.text();
      const visibleHtml = extractBodyHtml(removeNonContentBlocks(html));
      const title = extractTitle(html);
      const links = extractLinks(visibleHtml, url);
      const headings = extractHeadings(visibleHtml);
      const jsonLd = extractJsonLd(html);
      const text = stripTags(visibleHtml).slice(0, 5000);
      const observations = extractPageObservations({ url: url.toString(), text, links, headings, jsonLd });
      return {
        status: 'read',
        url: url.toString(),
        ...(title ? { title } : {}),
        ...(text ? { text } : {}),
        links,
        jsonLd,
        observations,
        entities: extractPageEntities({ url: url.toString(), title, text, jsonLd }),
      };
    } catch (error) {
      return {
        status: 'unavailable',
        url: url.toString(),
        reason: error instanceof Error ? error.message : String(error),
        links: [],
        jsonLd: [],
        entities: [],
        observations: [],
      };
    }
  }
}

const pageBridge = new WebPageBridge();

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
  const matches = [...html.matchAll(/<a[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)];
  return matches.map((match) => ({
    url: normalizeUrl(decodeHtml(match[1])),
    title: decodeHtml(stripTags(match[2])),
    snippet: decodeHtml(stripTags(match[3])),
  })).filter((item) => item.title && item.url);
}

function parseBingHtml(html: string): SearchWebResultItem[] {
  return [...html.matchAll(/<li\b[^>]*class=["'][^"']*\bb_algo\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)]
    .map((blockMatch) => {
      const block = blockMatch[1];
      const linkMatch = block.match(/<h2\b[^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i);
      if (!linkMatch) return null;
      const snippetMatch = block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
      return {
        url: normalizeUrl(decodeHtml(linkMatch[1])),
        title: decodeHtml(stripTags(linkMatch[2])),
        snippet: decodeHtml(stripTags(snippetMatch?.[1] ?? '')),
      };
    })
    .filter((item): item is SearchWebResultItem => Boolean(item?.title && item.url));
}

function safeHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function extractTitle(html: string): string | undefined {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeHtml(stripTags(title)) : undefined;
}

function removeNonContentBlocks(html: string): string {
  return html
    .replace(/<script\b(?![^>]*type=["']application\/ld\+json["'])[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ');
}

function extractBodyHtml(html: string): string {
  return html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
}

function extractLinks(html: string, baseUrl: URL): WebPageLink[] {
  const seen = new Set<string>();
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      const text = decodeHtml(stripTags(match[2]));
      const url = resolveUrl(decodeHtml(match[1]), baseUrl);
      return text && url ? { text, url } : null;
    })
    .filter((item): item is WebPageLink => {
      if (!item || seen.has(`${item.text}\n${item.url}`)) return false;
      seen.add(`${item.text}\n${item.url}`);
      return true;
    })
    .slice(0, 80);
}

function extractHeadings(html: string): string[] {
  const seen = new Set<string>();
  return [...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    .map((match) => decodeHtml(stripTags(match[1])))
    .filter((heading) => {
      if (!heading || seen.has(heading)) return false;
      seen.add(heading);
      return true;
    })
    .slice(0, 40);
}

function resolveUrl(value: string, baseUrl: URL): string | null {
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? normalizeUrl(url.toString()) : null;
  } catch {
    return null;
  }
}

function extractJsonLd(html: string): unknown[] {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => {
      try {
        const parsed = JSON.parse(decodeHtml(match[1]));
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    });
}

function extractPageEntities({
  url,
  text,
  jsonLd,
}: {
  url: string;
  title?: string;
  text: string;
  jsonLd: unknown[];
}): WebPageEntity[] {
  const entities = new Map<string, WebPageEntity>();
  const add = (name: string, entityUrl: string | undefined, evidence: string) => {
    const cleaned = cleanEntityName(name);
    if (!cleaned) return;
    const key = cleaned.toLocaleLowerCase();
    if (!entities.has(key)) {
      entities.set(key, {
        name: cleaned,
        ...(entityUrl ? { url: entityUrl } : {}),
        evidence,
      });
    }
  };

  for (const item of jsonLd) {
    for (const node of flattenJsonLd(item)) {
      if (!isRecord(node)) continue;
      if (!isPromotableJsonLdEntity(node)) continue;
      const name = typeof node.name === 'string' ? node.name : '';
      const entityUrl = typeof node.url === 'string' ? node.url : undefined;
      add(name, entityUrl, 'json-ld');
    }
  }
  for (const span of extractNamedTextSpans(text)) {
    if (!isPromotableTextEntity(span.label, span.localContext)) continue;
    add(span.label, url, 'page text');
  }
  return [...entities.values()].slice(0, 30);
}

function extractPageObservations({
  url,
  text,
  links,
  headings,
  jsonLd,
}: {
  url: string;
  text: string;
  links: WebPageLink[];
  headings: string[];
  jsonLd: unknown[];
}): WebPageObservation[] {
  const observations: WebPageObservation[] = [];
  const add = (observation: WebPageObservation) => {
    const label = cleanObservationLabel(observation.label);
    if (!label) return;
    observations.push({ ...observation, label });
  };

  for (const item of jsonLd) {
    for (const node of flattenJsonLd(item)) {
      if (!isRecord(node)) continue;
      const name = typeof node.name === 'string' ? node.name : '';
      const entityUrl = typeof node.url === 'string' ? node.url : undefined;
      add({
        kind: 'json-ld',
        label: name,
        ...(entityUrl ? { url: entityUrl } : {}),
        evidence: 'json-ld',
        sourceUrl: url,
      });
    }
  }
  for (const link of links) {
    add({
      kind: 'page-link',
      label: link.text,
      url: link.url,
      evidence: 'page link',
      sourceUrl: url,
    });
  }
  for (const heading of headings) {
    add({
      kind: 'heading',
      label: heading,
      evidence: 'heading',
      sourceUrl: url,
    });
  }
  for (const span of extractNamedTextSpans(text)) {
    add({
      kind: 'text-span',
      label: span.label,
      evidence: 'page text',
      localContext: span.localContext,
      sourceUrl: url,
    });
  }
  return observations.slice(0, 120);
}

function extractNamedTextSpans(text: string): Array<{ label: string; localContext: string }> {
  const spans: Array<{ label: string; localContext: string }> = [];
  const namedSpanPattern = /\b([A-Z][A-Za-z0-9&'.-]+(?:\s+(?:&|And|Of|The|At|In|[A-Z0-9][A-Za-z0-9&'.-]+)){1,6}(?:\s+(?:Theatre|Theater|Cinema|Cinemas|Restaurant|Bar|Cafe|Coffee|Park|Parks|Shop|Shops|Store|Market|Grill|Kitchen|Bistro|Tavern|Club|Lounge|Hotel|Museum|Center|Centre|Stadium|Arena))?)\b/g;
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  for (const sentence of sentences) {
    for (const match of sentence.matchAll(namedSpanPattern)) {
      spans.push({ label: normalizeSpanLabel(match[1]), localContext: sentence });
    }
  }
  return spans;
}

function normalizeSpanLabel(label: string): string {
  const entitySuffix = /^(?:Theatre|Theater|Cinema|Cinemas|Restaurant|Bar|Cafe|Coffee|Park|Parks|Shop|Shops|Store|Market|Grill|Kitchen|Bistro|Tavern|Club|Lounge|Hotel|Museum|Center|Centre|Stadium|Arena)$/i;
  const tokens = label.split(/\s+/).filter(Boolean);
  if (tokens.length > 6 && entitySuffix.test(tokens.at(-1) ?? '')) {
    return tokens.slice(-5).join(' ');
  }
  return label;
}

function isPromotableJsonLdEntity(node: Record<string, unknown>): boolean {
  const types = jsonLdTypes(node);
  if (types.length === 0) return false;
  if (types.some((type) => /^(?:article|newsarticle|blogposting|webpage|website|breadcrumblist|listitem|person|imageobject|videoobject)$/i.test(type))) {
    return false;
  }
  if (types.some((type) => /(?:localbusiness|place|restaurant|barorpub|cafeorcoffeeshop|movietheater|park|museum|store|bookstore|healthclub|sportsactivitylocation|musicvenue|eventvenue|theater|theatre|performingartstheater)/i.test(type))) {
    return true;
  }
  if (types.some((type) => /^organization$/i.test(type))) {
    return Boolean(node.address || node.geo || node.telephone || node.openingHours || node.openingHoursSpecification);
  }
  return false;
}

function jsonLdTypes(node: Record<string, unknown>): string[] {
  const raw = node['@type'];
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === 'string');
  return typeof raw === 'string' ? [raw] : [];
}

function isPromotableTextEntity(label: string, localContext: string): boolean {
  const cleaned = cleanEntityName(label);
  if (!cleaned) return false;
  if (isUiChromeLabel(cleaned) || isLocationOnlyLabel(cleaned) || isContextualLocationOnlyLabel(cleaned, localContext)) return false;
  const normalizedContext = localContext.replace(/\s+/g, ' ').trim();
  if (isMetadataOrChromeContext(normalizedContext)) return false;
  const namePattern = new RegExp(escapeRegExp(cleaned).replace(/\s+/g, '\\s+'), 'i');
  if (!namePattern.test(normalizedContext)) return false;
  return /\b(?:is|are|located|serves|offers|near|nearby|local|in|at|address|source-backed|option|venue|place)\b/i.test(normalizedContext);
}

function isUiChromeLabel(label: string): boolean {
  return /^(?:support|support enable|join now|join now enable|enable dark mode|dark mode|shop categories|categories|about us|contact|home|sign in|log in|login|account|profile|subscribe|join|help|privacy|terms)$/i.test(label)
    || /\b(?:support enable|join now enable|enable dark mode|shop categories|about us|sign in|log in|login|fanclub|fan club)\b/i.test(label);
}

function isLocationOnlyLabel(label: string): boolean {
  return /^(?:[A-Z]{2}\s*)?\d{5}(?:-\d{4})?$/i.test(label)
    || /^[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3},?\s+(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)$/i.test(label);
}

function isContextualLocationOnlyLabel(label: string, localContext: string): boolean {
  const pattern = new RegExp(`\\b(?:in|near|nearby|around|at|for)\\s+${escapeRegExp(label).replace(/\s+/g, '\\s+')}\\b\\s*,?\\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)?\\b`, 'i');
  return pattern.test(localContext)
    && !/\b(?:bar|pub|grill|restaurant|cafe|coffee|theat(?:er|re)|cinema|park|museum|book|shop|store|gym|fitness|venue|club|lounge|kitchen|bistro|market|center|centre)\b/i.test(label);
}

function isMetadataOrChromeContext(value: string): boolean {
  if (!value) return true;
  if (/[{}[\]":]/.test(value) && /\b(?:@context|@type|schema\.org|headline|author|publisher|datePublished)\b/i.test(value)) {
    return true;
  }
  if (/\b(?:navigation|nav|header|footer|account|menu|shop categories|support enable|join now enable|enable dark mode|dark mode|about us)\b/i.test(value)) {
    return true;
  }
  return false;
}

function flattenJsonLd(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!isRecord(value)) return [value];
  const graph = value['@graph'];
  return graph && Array.isArray(graph) ? [value, ...graph.flatMap(flattenJsonLd)] : [value];
}

function cleanEntityName(value: string): string {
  const cleaned = decodeHtml(value)
    .replace(/\s+-\s+.*$/g, '')
    .replace(/\s*\|\s*.*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 2 || cleaned.length > 96) return '';
  if (/\b(best|top|showtimes?|reviews?|near me|nearby|search|find|faq|frequently asked|movie times|local movie times|menus?|ratings?|hours?)\b/i.test(cleaned)) {
    return '';
  }
  if (isUiChromeLabel(cleaned)) return '';
  if (/[.!?]/.test(cleaned)) return '';
  return cleaned;
}

function cleanObservationLabel(value: string): string {
  const cleaned = decodeHtml(value)
    .replace(/\s+-\s+.*$/g, '')
    .replace(/\s*\|\s*.*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 2 || cleaned.length > 160) return '';
  if (/[.!?]/.test(cleaned)) return '';
  return cleaned;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeUrl(url: string): string {
  const duckDuckGoUrl = decodeDuckDuckGoRedirect(url);
  if (duckDuckGoUrl) return duckDuckGoUrl;
  const bingUrl = decodeBingRedirect(url);
  if (bingUrl) return bingUrl;
  return url;
}

function retryDelay(attempt: number): Promise<void> {
  if (attempt >= SEARCH_PROVIDER_ATTEMPTS) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, 150 * attempt));
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
  return value
    .replace(/<br\s*\/?>/gi, '. ')
    .replace(/<\/(?:p|div|li|h[1-6]|article|section|main|nav|header|footer|tr)\s*>/gi, '. ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+\./g, '.')
    .replace(/\.{2,}/g, '.')
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
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

async function readPageRequest(req: IncomingMessage): Promise<ReadWebPageRequest> {
  const parsedUrl = requestUrl(req.url);
  if (req.method === 'GET') {
    return { url: (parsedUrl.searchParams.get('url') ?? '').trim() };
  }
  const body = await readJsonBody(req);
  return {
    url: typeof (body as { url?: unknown }).url === 'string'
      ? (body as { url: string }).url.trim()
      : '',
  };
}

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

export function createWebPageApiMiddleware(webPageBridge: WebPageBridge = pageBridge) {
  return async (req: IncomingMessage, res: ServerResponse, next: (error?: Error) => void) => {
    if (requestUrl(req.url).pathname !== '/api/web-page') {
      next();
      return;
    }
    try {
      if (req.method !== 'POST' && req.method !== 'GET') {
        writeJson(res, 405, { error: 'Method not allowed.' });
        return;
      }
      const pageRequest = await readPageRequest(req);
      if (!pageRequest.url) {
        writeJson(res, 400, { error: 'url is required.' });
        return;
      }
      writeJson(res, 200, await webPageBridge.read(pageRequest));
    } catch (error) {
      next(error instanceof Error ? error : new Error('Web page middleware failed.'));
    }
  };
}
