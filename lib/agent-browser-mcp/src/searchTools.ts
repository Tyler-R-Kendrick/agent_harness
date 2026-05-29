import { ModelContext } from '@agent-harness/webmcp';

import type {
  RegisterWorkspaceToolsOptions,
  WorkspaceMcpReadWebPageResult,
  WorkspaceMcpSearchWebResult,
} from './workspaceToolTypes';

type SearchInput = {
  query?: string;
  limit?: number;
};

type ReadWebPageInput = {
  url?: string;
};

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
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
  const parsePart = (part: string): number[] => {
    if (!part) {
      return [];
    }

    return part.split(':').map((token) => Number.parseInt(token, 16));
  };

  const left = parsePart(parts[0] || '');
  const right = parsePart(parts[1] || '');

  if (parts.length === 1) {
    return left;
  }

  const zeroFillCount = 8 - (left.length + right.length);
  return [...left, ...Array.from({ length: zeroFillCount }, () => 0), ...right];
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

  const isIpv4Mapped = segments.slice(0, 5).every((segment) => segment === 0) && segments[5] === 0xffff;
  if (isIpv4Mapped) {
    const ipv4Segments = [
      (segments[6]! >> 8) & 0xff,
      segments[6]! & 0xff,
      (segments[7]! >> 8) & 0xff,
      segments[7]! & 0xff,
    ];
    return isPrivateIpv4Hostname(ipv4Segments.join('.'));
  }

  return false;
}

function isPublicWebHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
    return false;
  }

  return !isPrivateIpv4Hostname(normalized) && !isPrivateIpv6Hostname(normalized);
}

function readQuery(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('Search query must not be empty.');
  }
  return value.trim().replace(/\s+/g, ' ');
}

function readLimit(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(10, Math.floor(value))
    : 5;
}

function readUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('Web page URL must not be empty.');
  }
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new TypeError('Only http and https URLs can be read.');
    }
    if (url.username || url.password) {
      throw new TypeError('Web page URL must not include embedded credentials.');
    }
    if (!isPublicWebHostname(url.hostname)) {
      throw new TypeError('Web page URL must target a public web host.');
    }
    return url.toString();
  } catch (error) {
    if (
      error instanceof TypeError
      && (
        error.message === 'Only http and https URLs can be read.'
        || error.message === 'Web page URL must not include embedded credentials.'
        || error.message === 'Web page URL must target a public web host.'
      )
    ) {
      throw error;
    }
    throw new TypeError('Web page URL must be a valid absolute URL.');
  }
}

function normalizeResult(result: WorkspaceMcpSearchWebResult, query: string): WorkspaceMcpSearchWebResult {
  return {
    status: result.status,
    query: result.query.trim() || query,
    results: result.results.map((item) => ({
      title: item.title.trim(),
      url: item.url.trim(),
      snippet: item.snippet.trim(),
    })).filter((item) => item.title && item.url),
    ...(result.reason ? { reason: result.reason } : {}),
  };
}

function normalizePageResult(result: WorkspaceMcpReadWebPageResult, url: string): WorkspaceMcpReadWebPageResult {
  return {
    status: result.status,
    url: result.url.trim() || url,
    ...(result.title?.trim() ? { title: result.title.trim() } : { title: undefined }),
    ...(result.text?.trim() ? { text: result.text.trim() } : { text: undefined }),
    links: result.links
      .map((item) => ({
        text: item.text.trim(),
        url: item.url.trim(),
      }))
      .filter((item) => item.text && item.url),
    jsonLd: [...result.jsonLd],
    entities: result.entities
      .map((item) => ({
        name: item.name.trim(),
        ...(item.url?.trim() ? { url: item.url.trim() } : {}),
        evidence: item.evidence.trim(),
      }))
      .filter((item) => item.name && item.evidence),
    observations: (result.observations ?? [])
      .map((item) => ({
        kind: item.kind,
        label: item.label.trim(),
        ...(item.url?.trim() ? { url: item.url.trim() } : {}),
        evidence: item.evidence.trim(),
        ...(item.localContext?.trim() ? { localContext: item.localContext.trim() } : {}),
        sourceUrl: item.sourceUrl.trim(),
      }))
      .filter((item) => item.label && item.evidence && item.sourceUrl),
    ...(result.reason?.trim() ? { reason: result.reason.trim() } : {}),
  };
}

export function registerSearchTools(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const { onSearchWeb, onReadWebPage, signal } = options;

  modelContext.registerTool({
    name: 'search_web',
    title: 'Search web',
    description: 'Search the web for current external facts, restaurant recommendations, local places, and source snippets needed to answer the user task.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    execute: async (input: object) => {
      const typedInput = input as SearchInput;
      const query = readQuery(typedInput.query);
      const limit = readLimit(typedInput.limit);
      if (!onSearchWeb) {
        return {
          status: 'unavailable' as const,
          query,
          reason: 'Web search is not configured for this workspace.',
          results: [],
        };
      }
      return normalizeResult(await onSearchWeb({ query, limit }), query);
    },
    annotations: { readOnlyHint: true },
  }, { signal });

  modelContext.registerTool({
    name: 'read_web_page',
    title: 'Read web page',
    description: 'Read a web search result page and extract generic text, links, JSON-LD metadata, and candidate entities needed to answer the user task.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
      },
      required: ['url'],
      additionalProperties: false,
    },
    execute: async (input: object) => {
      const url = readUrl((input as ReadWebPageInput).url);
      if (!onReadWebPage) {
        return {
          status: 'unavailable' as const,
          url,
          reason: 'Web page reading is not configured for this workspace.',
          title: undefined,
          text: undefined,
          links: [],
          jsonLd: [],
          entities: [],
          observations: [],
        };
      }
      return normalizePageResult(await onReadWebPage({ url }), url);
    },
    annotations: { readOnlyHint: true },
  }, { signal });
}
