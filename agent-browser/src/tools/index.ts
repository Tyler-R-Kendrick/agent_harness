import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { z } from 'zod';
import { LOCAL_WEB_RESEARCH_TOOL_ID, runLocalWebResearchAgent } from '../chat-agents/LocalWebResearch';
import { RDF_SEMANTIC_SEARCH_TOOL_ID, runRdfWebSearchAgent } from '../chat-agents/SemanticSearch';
import { buildToolInstructionsTemplate } from '../services/agentPromptTemplates';
import { createCliTool } from './cli';
import type { TerminalExecutorContext } from './types';

export type ToolGroup =
  | 'built-in'
  | 'mcp'
  | 'webmcp'
  | 'worktree-mcp'
  | 'renderer-viewport-mcp'
  | 'browser-worktree-mcp'
  | 'sessions-worktree-mcp'
  | 'files-worktree-mcp'
  | 'clipboard-worktree-mcp'
  | 'user-context-mcp'
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
  'browser-worktree-mcp': 'Browser page navigation, reading, and history tools.',
  'sessions-worktree-mcp': 'Session management, agent switching, and conversation control tools.',
  'files-worktree-mcp': 'Workspace and session filesystem tools for reading and editing files.',
  'clipboard-worktree-mcp': 'Clipboard inspection and restore tools.',
  'user-context-mcp': 'User context tools for app memory, browser location, and eliciting missing data.',
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
    description: 'Search local SearXNG, extract pages, rank evidence, and return citations for agent workflow fan-in.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: RDF_SEMANTIC_SEARCH_TOOL_ID,
    label: 'Semantic search',
    description: 'Query public RDF/SPARQL endpoints through checked templates and return normalized semantic evidence.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
];

export const DEFAULT_TOOL_IDS: string[] = DEFAULT_TOOL_DESCRIPTORS.map((descriptor) => descriptor.id);

export function createDefaultTools(context: TerminalExecutorContext): ToolSet {
  return {
    cli: createCliTool(context),
    [LOCAL_WEB_RESEARCH_TOOL_ID]: tool({
      description: 'Search local SearXNG, extract source pages, rank evidence chunks, and return citations.',
      inputSchema: z.object({
        question: z.string().trim().min(1).max(500),
        maxSearchResults: z.number().int().positive().max(25).optional(),
        maxPagesToExtract: z.number().int().positive().max(10).optional(),
        maxEvidenceChunks: z.number().int().positive().max(20).optional(),
        synthesize: z.boolean().optional(),
        searxngBaseUrl: z.string().url().optional(),
      }),
      execute: async ({
        question,
        maxSearchResults,
        maxPagesToExtract,
        maxEvidenceChunks,
        synthesize,
        searxngBaseUrl,
      }) => runLocalWebResearchAgent(question, {
        ...(maxSearchResults !== undefined ? { maxSearchResults } : {}),
        ...(maxPagesToExtract !== undefined ? { maxPagesToExtract } : {}),
        ...(maxEvidenceChunks !== undefined ? { maxEvidenceChunks } : {}),
        ...(synthesize !== undefined ? { synthesize } : {}),
        ...(searxngBaseUrl !== undefined ? { searxngBaseUrl } : {}),
      }),
    }),
    [RDF_SEMANTIC_SEARCH_TOOL_ID]: tool({
      description: 'Search public RDF/SPARQL endpoints with checked templates and normalized citations.',
      inputSchema: z.object({
        question: z.string().trim().min(1).max(500),
        limit: z.number().int().positive().max(25).optional(),
        endpointUrl: z.string().url().optional(),
      }),
      execute: async ({ question, limit, endpointUrl }) => runRdfWebSearchAgent(question, {
        ...(limit !== undefined ? { defaultLimit: limit } : {}),
        ...(endpointUrl !== undefined ? { endpointUrl } : {}),
      }),
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
