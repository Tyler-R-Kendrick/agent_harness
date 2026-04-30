import { describe, expect, it, vi } from 'vitest';
import type { ToolSet } from 'ai';
import { PayloadType, type Payload } from 'logact';
import { resolveExecutionRequirements } from './executionRequirements';
import { RDF_WEB_SEARCH_AGENT_ID } from '../chat-agents/SemanticSearch';
import type { ToolAgentRuntime, ToolPlan } from '../tool-agents/tool-agent';
import type { ToolDescriptor } from '../tools';

const descriptors: ToolDescriptor[] = [
  {
    id: 'webmcp:search_web',
    label: 'Search web',
    description: 'Search the public web for current source evidence.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'webmcp:semantic_search',
    label: 'Semantic search',
    description: 'Search RDF and SPARQL endpoints for normalized open-data results.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'webmcp:read_web_page',
    label: 'Read web page',
    description: 'Read source pages and extract named entity evidence.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
];

function plan(): ToolPlan {
  const selectedToolIds = descriptors.map((descriptor) => descriptor.id);
  return {
    version: 1,
    goal: 'search Ada Lovelace facts',
    selectedToolIds,
    steps: [],
    createdToolFiles: [],
    actorToolAssignments: {
      executor: selectedToolIds,
      'web-search-agent': ['webmcp:search_web', 'webmcp:read_web_page'],
      [RDF_WEB_SEARCH_AGENT_ID]: ['webmcp:semantic_search'],
    },
  };
}

describe('resolveExecutionRequirements RDF semantic search fan-in', () => {
  it('runs semantic search parallel to web search, logs AgentBus entries, and reranks RDF evidence', async () => {
    const events: string[] = [];
    let releaseWebSearch!: () => void;
    const webSearchGate = new Promise<void>((resolve) => {
      releaseWebSearch = resolve;
    });
    const busAppend = vi.fn(async (_payload: Payload) => ({ id: 'entry' }));
    const search = vi.fn(async ({ query }: { query: string }) => {
      events.push(`web-start:${query}`);
      await webSearchGate;
      events.push('web-end');
      return {
        status: 'found',
        query,
        results: [{
          title: 'Generic biography overview',
          url: 'https://example.com/overview',
          snippet: 'A broad overview with weak entity evidence.',
        }],
      };
    });
    const semanticSearch = vi.fn(async ({ question }: { question: string }) => {
      events.push(`rdf-start:${question}`);
      releaseWebSearch();
      events.push('rdf-end');
      return {
        query: question,
        intent: { kind: 'entitySearch', text: question, limit: 5 },
        endpointId: 'wikidata',
        generatedQuery: 'SELECT ?item ?itemLabel WHERE { SERVICE wikibase:mwapi { } } LIMIT 5',
        results: [{
          id: 'Q7259',
          title: 'Ada Lovelace',
          url: 'https://www.wikidata.org/wiki/Q7259',
          source: 'wikidata',
          sourceName: 'Wikidata',
          description: 'English mathematician and writer',
          score: 0.98,
          facts: [
            { label: 'instance of', value: 'human' },
            { label: 'occupation', value: 'mathematician' },
          ],
        }],
        errors: [],
        elapsedMs: 3,
      };
    });
    const runtime: ToolAgentRuntime = {
      descriptors,
      tools: {
        'webmcp:search_web': { execute: search },
        'webmcp:semantic_search': { execute: semanticSearch },
        'webmcp:read_web_page': { execute: vi.fn() },
      } as unknown as ToolSet,
    };

    const result = await resolveExecutionRequirements({
      runtime,
      plan: plan(),
      messages: [{ role: 'user', content: 'search Ada Lovelace facts' }],
      executionContext: {
        bus: { append: busAppend } as never,
        toolPolicy: {
          allowedToolIds: descriptors.map((descriptor) => descriptor.id),
          assignments: plan().actorToolAssignments ?? {},
        },
      },
      callbacks: {},
    });

    expect(events).toEqual([
      'web-start:search ada lovelace facts',
      'rdf-start:search Ada Lovelace facts',
      'rdf-end',
      'web-end',
    ]);
    expect(result.status).toBe('fulfilled');
    if (result.status !== 'fulfilled') {
      throw new Error(`Expected fulfilled result, got ${result.status}.`);
    }
    expect(result.result.text).toContain('[Ada Lovelace](https://www.wikidata.org/wiki/Q7259)');
    expect(result.result.text).not.toContain('Generic biography overview');

    const semanticToolEntry = busAppend.mock.calls
      .map(([payload]) => payload)
      .find((payload) => (
        payload.type === PayloadType.Result
        && String(payload.intentId).includes('webmcp-semantic_search')
      ));
    expect(semanticToolEntry?.meta).toMatchObject({
      actorId: RDF_WEB_SEARCH_AGENT_ID,
      actorRole: 'search-agent',
      branchId: `agent:${RDF_WEB_SEARCH_AGENT_ID}`,
      agentLabel: 'RDF Web Search Agent',
      modelProvider: 'deterministic-rdf',
    });
    expect(busAppend.mock.calls.some(([payload]) => (
      payload.type === PayloadType.InfOut
      && payload.meta?.actorId === 'search-fan-in-merger'
      && String(payload.text).includes('RDF semantic search')
    ))).toBe(true);
  });
});
