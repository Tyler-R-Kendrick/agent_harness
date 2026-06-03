import type { IncomingMessage, ServerResponse } from 'node:http';

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

const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export class WebPageBridge {
  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
  ) {}

  async read(request: ReadWebPageRequest): Promise<ReadWebPageResult> {
    const normalizedUrl = normalizeUrl(request.url.trim());
    const urlResult = safeHttpUrl(normalizedUrl);
    if (!urlResult.ok) {
      return {
        status: 'blocked',
        url: normalizedUrl,
        reason: urlResult.reason,
        links: [],
        jsonLd: [],
        entities: [],
        observations: [],
      };
    }
    const url = urlResult.url;

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
      const jsonLd = extractJsonLd(html);
      const contentHtml = removeNonContentBlocks(html);
      const title = extractTitle(html);
      const links = extractLinks(contentHtml, url);
      const headings = extractHeadings(contentHtml);
      const text = readableText(contentHtml).slice(0, 5000);
      const observations = extractPageObservations({ url: url.toString(), text, links, headings, jsonLd });
      return {
        status: 'read',
        url: url.toString(),
        ...(title ? { title } : {}),
        ...(text ? { text } : {}),
        links,
        jsonLd,
        observations,
        entities: extractPageEntities({ url: url.toString(), text, jsonLd }),
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

function safeHttpUrl(value: string): { ok: true; url: URL } | { ok: false; reason: string } {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, reason: 'Only http and https URLs can be read.' };
    }
    if (!isPublicWebHostname(url.hostname)) {
      return { ok: false, reason: 'Web page URL must target a public web host.' };
    }
    return { ok: true, url };
  } catch {
    return { ok: false, reason: 'Only http and https URLs can be read.' };
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/g, '');
}

function isIpv4Hostname(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function parseIpv4Segments(hostname: string): number[] | null {
  if (!isIpv4Hostname(hostname)) {
    return null;
  }

  return hostname.split('.').map((segment) => Number.parseInt(segment, 10));
}

function isPrivateIpv4Hostname(hostname: string): boolean {
  const segments = parseIpv4Segments(hostname);
  if (!segments) {
    return false;
  }

  const [first, second] = segments;
  if (first === 0 || first === 10 || first === 127) {
    return true;
  }
  if (first === 100 && second >= 64 && second <= 127) {
    return true;
  }
  if (first === 169 && second === 254) {
    return true;
  }
  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }
  if (first === 192 && second === 168) {
    return true;
  }
  if (first === 198 && (second === 18 || second === 19)) {
    return true;
  }

  return false;
}

function parseIpv6Segments(hostname: string): number[] | null {
  const normalized = normalizeHostname(hostname);
  if (!normalized.includes(':')) {
    return null;
  }

  const parts = normalized.split('::');
  if (parts.length > 2) {
    return null;
  }

  const parsePart = (part: string): number[] | null => {
    if (!part) {
      return [];
    }

    const segments = part.split(':').map((token) => Number.parseInt(token, 16));
    return segments.every((segment) => Number.isInteger(segment) && segment >= 0 && segment <= 0xffff)
      ? segments
      : null;
  };

  const left = parsePart(parts[0] || '');
  const right = parsePart(parts[1] || '');
  if (!left || !right) {
    return null;
  }

  if (parts.length === 1) {
    return left.length === 8 ? left : null;
  }

  const zeroFillCount = 8 - (left.length + right.length);
  if (zeroFillCount < 1) {
    return null;
  }
  return [...left, ...Array.from({ length: zeroFillCount }, () => 0), ...right];
}

function extractEmbeddedIpv4SegmentsFromIpv6(hostname: string): number[] | null {
  const segments = parseIpv6Segments(hostname);
  if (!segments) {
    return null;
  }

  const lastIpv4Segments = [
    (segments[6]! >> 8) & 0xff,
    segments[6]! & 0xff,
    (segments[7]! >> 8) & 0xff,
    segments[7]! & 0xff,
  ];

  const isIpv4Compatible = segments.slice(0, 6).every((segment) => segment === 0);
  if (isIpv4Compatible) {
    return lastIpv4Segments;
  }

  const isIpv4Mapped = segments.slice(0, 5).every((segment) => segment === 0) && segments[5] === 0xffff;
  if (isIpv4Mapped) {
    return lastIpv4Segments;
  }

  const isWellKnownNat64 = segments[0] === 0x64 && segments[1] === 0xff9b && segments[2] === 0 && segments[3] === 0 && segments[4] === 0 && segments[5] === 0;
  if (isWellKnownNat64) {
    return lastIpv4Segments;
  }

  if (segments[0] === 0x2002) {
    return [
      (segments[1]! >> 8) & 0xff,
      segments[1]! & 0xff,
      (segments[2]! >> 8) & 0xff,
      segments[2]! & 0xff,
    ];
  }

  return null;
}

function isPrivateIpv6Hostname(hostname: string): boolean {
  const segments = parseIpv6Segments(hostname);
  if (!segments) {
    return false;
  }

  if (segments.every((segment) => segment === 0) || segments.every((segment, index) => segment === (index === 7 ? 1 : 0))) {
    return true;
  }

  if ((segments[0]! & 0xffc0) === 0xfe80) {
    return true;
  }

  if ((segments[0]! & 0xfe00) === 0xfc00) {
    return true;
  }

  const embeddedIpv4Segments = extractEmbeddedIpv4SegmentsFromIpv6(hostname);
  if (embeddedIpv4Segments) {
    return isPrivateIpv4Hostname(embeddedIpv4Segments.join('.'));
  }

  return false;
}

const LOOPBACK_DNS_SUFFIXES = ['nip.io', 'sslip.io', 'xip.io'] as const;

function isLoopbackDnsHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  for (const suffix of LOOPBACK_DNS_SUFFIXES) {
    if (!normalized.endsWith(`.${suffix}`)) {
      continue;
    }

    const candidate = normalized.slice(0, -(suffix.length + 1)).replace(/-/g, '.');
    if (candidate === 'localhost' || candidate.endsWith('.localhost')) {
      return true;
    }

    if (isPrivateIpv4Hostname(candidate)) {
      return true;
    }
  }

  return false;
}

function isPublicWebHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
    return false;
  }

  if (isLoopbackDnsHostname(normalized)) {
    return false;
  }

  return !isPrivateIpv4Hostname(normalized) && !isPrivateIpv6Hostname(normalized);
}

function extractTitle(html: string): string | undefined {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = match ? textFromHtml(match[1] ?? '') : '';
  return title || undefined;
}

function removeNonContentBlocks(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ');
}

function readableText(html: string): string {
  const blocks = [...html.matchAll(/<(p|li|h[1-6]|article|section|main)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => textFromHtml(match[2] ?? ''))
    .filter(Boolean);
  const source = blocks.length > 0 ? blocks.join('. ') : textFromHtml(html);
  return normalizeText(source)
    .replace(/\s+\./g, '.')
    .replace(/\.{2,}/g, '.');
}

function extractLinks(html: string, baseUrl: URL): WebPageLink[] {
  const seen = new Set<string>();
  const links: WebPageLink[] = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = readAttribute(match[1] ?? '', 'href');
    const text = textFromHtml(match[2] ?? '');
    const url = href ? resolveUrl(href, baseUrl) : null;
    if (!text || !url) continue;
    const key = `${text}\n${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ text, url });
    if (links.length >= 80) break;
  }
  return links;
}

function extractHeadings(html: string): string[] {
  const seen = new Set<string>();
  const headings: string[] = [];
  for (const match of html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)) {
    const heading = textFromHtml(match[1] ?? '');
    if (!heading || seen.has(heading)) continue;
    seen.add(heading);
    headings.push(heading);
    if (headings.length >= 40) break;
  }
  return headings;
}

function readAttribute(attributes: string, name: string): string | undefined {
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = pattern.exec(attributes);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value ? decodeHtml(value) : undefined;
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
  const results: unknown[] = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const type = readAttribute(match[1] ?? '', 'type') ?? '';
    if (!/^application\/ld\+json$/i.test(type.trim())) continue;
    try {
      const parsed = JSON.parse((match[2] ?? '').trim());
      const decoded = decodeJsonLdValue(parsed);
      results.push(...(Array.isArray(decoded) ? decoded : [decoded]));
    } catch {
      // Ignore malformed JSON-LD and keep extracting visible page evidence.
    }
  }
  return results;
}

function decodeJsonLdValue(value: unknown): unknown {
  if (typeof value === 'string') return decodeHtml(value);
  if (Array.isArray(value)) return value.map(decodeJsonLdValue);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, decodeJsonLdValue(entry)]));
  }
  return value;
}

function extractPageEntities({
  url,
  text,
  jsonLd,
}: {
  url: string;
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
  if (isUiChromeLabel(cleaned) || isLocationOnlyLabel(cleaned) || isContextualLocationOnlyLabel(cleaned, localContext)) {
    return false;
  }
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

function isMovieTimeDirectoryLabel(label: string): boolean {
  const normalized = label.replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  return /^(?:(?:movie\s+times?|movies?)\s+by\s+(?:cities|city|states?|zip(?:\s+codes?)?)|(?:cities|city|states?|zip(?:\s+codes?)?)\s+movie\s+times?)$/i.test(normalized)
    || /\b(?:movie\s+times?|movies?)\s+by\s+(?:cities|city|states?|zip(?:\s+codes?)?)\b/i.test(normalized)
    || /\b(?:cities|city|states?|zip(?:\s+codes?)?)\s+movie\s+times?\b/i.test(normalized);
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
  if (isMovieTimeDirectoryLabel(cleaned)) return '';
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
  if (isMovieTimeDirectoryLabel(cleaned)) return '';
  if (/[.!?]/.test(cleaned)) return '';
  return cleaned;
}

function textFromHtml(html: string): string {
  return decodeHtml(stripTags(html));
}

function stripTags(value: string): string {
  return value
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
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
      try {
        if (normalized.startsWith('#x')) return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
        if (normalized.startsWith('#')) return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
      } catch {
        return entity;
      }
      return entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
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

function requestUrl(rawUrl: string | undefined): URL {
  return new URL(rawUrl || '/', 'http://localhost');
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
