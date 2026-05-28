import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { z } from 'zod';
import { LOCAL_WEB_RESEARCH_TOOL_ID, runLocalWebResearchAgent } from '../chat-agents/LocalWebResearch';
import { stableHash } from '../chat-agents/LocalWebResearch/local-web-research/hash';
import { normalizeUrl } from '../chat-agents/LocalWebResearch/local-web-research/normalizeUrl';
import type {
  ExtractedPage,
  Extractor,
  SearchProvider,
  WebSearchResult,
} from '../chat-agents/LocalWebResearch/local-web-research/types';
import { buildToolInstructionsTemplate } from '../services/agentPromptTemplates';
import { createCliTool } from './cli';
import type { AppWebPageResult, AppWebSearchResult, TerminalExecutorContext } from './types';

const WEB_SEARCH_PROVIDER_NAMES = ['searxng', 'perplexity', 'tavily', 'duckduckgo-instant'] as const;

export type ToolGroup =
  | 'built-in'
  | 'mcp'
  | 'webmcp'
  | 'worktree-mcp'
  | 'renderer-viewport-mcp'
  | 'harness-ui-mcp'
  | 'browser-worktree-mcp'
  | 'sessions-worktree-mcp'
  | 'files-worktree-mcp'
  | 'clipboard-worktree-mcp'
  | 'artifacts-mcp'
  | 'user-context-mcp'
  | 'settings-mcp'
  | 'secrets-mcp'
  | 'web-search-mcp';

export interface ToolDescriptor {
  id: string;
  label: string;
  description: string;
  group: ToolGroup;
  groupLabel: string;
  subGroup?: string;
  subGroupLabel?: string;
}

export interface ToolGroupDescriptor {
  id: ToolGroup;
  label: string;
  description: string;
  toolIds: string[];
}

const TOOL_GROUP_DESCRIPTIONS: Readonly<Record<ToolGroup, string>> = {
  'built-in': 'General workspace tools such as shell commands and broad utility actions.',
  mcp: 'External MCP tools bridged into the active workspace.',
  webmcp: 'Generic WebMCP tools that are not tied to a specific workspace surface.',
  'worktree-mcp': 'Workspace-level tools that act across the current workspace state.',
  'renderer-viewport-mcp': 'Renderer and viewport inspection tools for visible output surfaces.',
  'harness-ui-mcp': 'Harness UI tools for reading, editing, and regenerating app surfaces.',
  'browser-worktree-mcp': 'Browser page navigation, reading, and history tools.',
  'sessions-worktree-mcp': 'Session management, agent switching, and conversation control tools.',
  'files-worktree-mcp': 'Workspace and session filesystem tools for reading and editing files.',
  'clipboard-worktree-mcp': 'Clipboard inspection and restore tools.',
  'artifacts-mcp': 'Artifact tools for standalone, versioned, downloadable workspace outputs.',
  'user-context-mcp': 'User context tools for app memory, browser location, and eliciting missing data.',
  'settings-mcp': 'Settings tools for reading and editing global, project, and session settings.json files.',
  'secrets-mcp': 'Secret request tools that return secret-ref handles without exposing raw values.',
  'web-search-mcp': 'Web search tools for current external facts, source snippets, and local recommendations.',
};

export const DEFAULT_TOOL_DESCRIPTORS: ToolDescriptor[] = [
  {
    id: 'cli',
    label: 'CLI',
    description: 'Run bash commands in the active workspace terminal session.',
    group: 'built-in',
    groupLabel: 'Built-In',
  },
  {
    id: LOCAL_WEB_RESEARCH_TOOL_ID,
    label: 'Local web research',
    description: 'Search SearXNG or a configured web search provider, extract pages, rank evidence, and return citations for agent workflow fan-in.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
];

export const DEFAULT_TOOL_IDS: string[] = DEFAULT_TOOL_DESCRIPTORS.map((descriptor) => descriptor.id);

function hasExplicitLocalWebResearchProvider({
  searchProviderName,
  searxngBaseUrl,
  perplexityApiKey,
  tavilyApiKey,
}: {
  searchProviderName?: string;
  searxngBaseUrl?: string;
  perplexityApiKey?: string;
  tavilyApiKey?: string;
}): boolean {
  return Boolean(searchProviderName || searxngBaseUrl || perplexityApiKey || tavilyApiKey);
}

function createAppBackedSearchProvider(
  searchWeb: NonNullable<TerminalExecutorContext['searchWeb']>,
): SearchProvider {
  return {
    id: 'app-web-search',
    async search(request) {
      return appSearchResultToLocalResults(
        await searchWeb({ query: request.query, limit: request.maxResults }),
        request.maxResults,
      );
    },
  };
}

function appSearchResultToLocalResults(result: AppWebSearchResult, maxResults: number): WebSearchResult[] {
  if (result.status !== 'found') return [];
  return result.results.slice(0, maxResults).map((item, index) => {
    const normalizedUrl = normalizeUrl(item.url);
    return {
      id: `search-${stableHash(normalizedUrl)}`,
      title: item.title,
      url: item.url,
      normalizedUrl,
      ...(item.snippet ? { snippet: item.snippet } : {}),
      provider: 'custom' as const,
      rank: index + 1,
      metadata: { source: 'app-web-search' },
    };
  });
}

function createAppBackedPageExtractor(
  readWebPage: NonNullable<TerminalExecutorContext['readWebPage']>,
): Extractor {
  return {
    async extract(request) {
      const result = await readWebPage({ url: request.url });
      if (result.status !== 'read') {
        throw new Error(result.reason || `App web page reader returned ${result.status}.`);
      }
      return appPageResultToExtractedPage(result, request.url, request.sourceResultId);
    },
  };
}

function appPageResultToExtractedPage(
  result: AppWebPageResult,
  requestedUrl: string,
  sourceResultId?: string,
): ExtractedPage {
  const finalUrl = result.url || requestedUrl;
  const normalized = normalizeUrl(finalUrl);
  const evidence = [
    result.text,
    ...result.entities.map((entity) => entity.evidence),
    ...(result.observations ?? []).map((observation) => observation.evidence),
  ].map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  const text = evidence.join('\n\n').trim();
  if (!text) {
    throw new Error('App web page reader returned no extractable text.');
  }
  return {
    id: `page-${stableHash(normalized)}`,
    url: requestedUrl,
    finalUrl,
    normalizedUrl: normalized,
    ...(result.title?.trim() ? { title: result.title.trim() } : {}),
    excerpt: text.slice(0, 280),
    text,
    length: text.length,
    fetchedAt: new Date().toISOString(),
    ...(sourceResultId ? { sourceResultId } : {}),
  };
}

export function createDefaultTools(context: TerminalExecutorContext): ToolSet {
  return {
    cli: createCliTool(context),
    [LOCAL_WEB_RESEARCH_TOOL_ID]: tool({
      description: 'Search SearXNG, Perplexity SDK, Tavily SDK, or DuckDuckGo Instant, extract source pages, rank evidence chunks, and return citations.',
      inputSchema: z.object({
        question: z.string().trim().min(1).max(500),
        searchProviderName: z.enum(WEB_SEARCH_PROVIDER_NAMES).optional(),
        maxSearchResults: z.number().int().positive().max(25).optional(),
        maxPagesToExtract: z.number().int().positive().max(10).optional(),
        maxEvidenceChunks: z.number().int().positive().max(20).optional(),
        synthesize: z.boolean().optional(),
        searxngBaseUrl: z.string().url().optional(),
        perplexityApiKey: z.string().trim().min(1).optional(),
        tavilyApiKey: z.string().trim().min(1).optional(),
      }),
      execute: async ({
        question,
        searchProviderName,
        maxSearchResults,
        maxPagesToExtract,
        maxEvidenceChunks,
        synthesize,
        searxngBaseUrl,
        perplexityApiKey,
        tavilyApiKey,
      }) => {
        const explicitProvider = hasExplicitLocalWebResearchProvider({
          searchProviderName,
          searxngBaseUrl,
          perplexityApiKey,
          tavilyApiKey,
        });
        return runLocalWebResearchAgent(question, {
          ...(!explicitProvider && context.searchWeb
            ? { searchProvider: createAppBackedSearchProvider(context.searchWeb) }
            : {}),
          ...(!explicitProvider && context.readWebPage
            ? { extractor: createAppBackedPageExtractor(context.readWebPage) }
            : {}),
          ...(searchProviderName !== undefined ? { searchProviderName } : {}),
          ...(maxSearchResults !== undefined ? { maxSearchResults } : {}),
          ...(maxPagesToExtract !== undefined ? { maxPagesToExtract } : {}),
          ...(maxEvidenceChunks !== undefined ? { maxEvidenceChunks } : {}),
          ...(synthesize !== undefined ? { synthesize } : {}),
          ...(searxngBaseUrl !== undefined ? { searxngBaseUrl } : {}),
          ...(perplexityApiKey !== undefined ? { perplexityApiKey } : {}),
          ...(tavilyApiKey !== undefined ? { tavilyApiKey } : {}),
        });
      },
    }),
  } as ToolSet;
}

export function selectToolsByIds(allTools: ToolSet, selectedIds: readonly string[]): ToolSet {
  const allowed = new Set(selectedIds);
  const filtered = {} as ToolSet;
  for (const key of Object.keys(allTools)) {
    if (allowed.has(key)) {
      filtered[key] = allTools[key];
    }
  }
  return filtered;
}

export function selectToolDescriptorsByIds(
  descriptors: readonly ToolDescriptor[],
  selectedIds: readonly string[],
): ToolDescriptor[] {
  const allowed = new Set(selectedIds);
  return descriptors.filter((descriptor) => allowed.has(descriptor.id));
}

export function buildToolGroupDescriptors(descriptors: readonly ToolDescriptor[]): ToolGroupDescriptor[] {
  const buckets = new Map<ToolGroup, ToolGroupDescriptor>();

  for (const descriptor of descriptors) {
    const id = (descriptor.subGroup ?? descriptor.group) as ToolGroup;
    const label = descriptor.subGroupLabel ?? descriptor.groupLabel;
    const bucket = buckets.get(id) ?? {
      id,
      label,
      description: TOOL_GROUP_DESCRIPTIONS[id],
      toolIds: [],
    };
    bucket.toolIds.push(descriptor.id);
    buckets.set(id, bucket);
  }

  return [...buckets.values()].sort((left, right) => left.label.localeCompare(right.label));
}

export function buildDefaultToolInstructions({
  workspaceName,
  workspacePromptContext,
  descriptors = DEFAULT_TOOL_DESCRIPTORS,
  selectedToolIds,
  selectedGroups,
}: {
  workspaceName: string;
  workspacePromptContext: string;
  descriptors?: readonly Pick<ToolDescriptor, 'id' | 'label' | 'description'>[];
  selectedToolIds?: readonly string[];
  selectedGroups?: readonly string[];
}): string {
  return buildToolInstructionsTemplate({
    workspaceName,
    workspacePromptContext,
    descriptors,
    selectedToolIds,
    selectedGroups,
  });
}
