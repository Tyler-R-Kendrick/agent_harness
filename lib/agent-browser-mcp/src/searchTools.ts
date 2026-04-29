import { ModelContext } from '../../webmcp/src/index';

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
    return url.toString();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Only http and https URLs can be read.') {
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
