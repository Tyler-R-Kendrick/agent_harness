import { describe, expect, it, vi } from 'vitest';
import type { ToolSet } from 'ai';
import { PayloadType, type Payload } from 'logact';
import { resolveExecutionRequirements } from './executionRequirements';
import { LOCAL_WEB_RESEARCH_AGENT_ID } from '../chat-agents/LocalWebResearch';
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
    id: 'webmcp:local_web_research',
    label: 'Local web research',
    description: 'Search local SearXNG and return ranked evidence with citations.',
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
    goal: 'search local web search agents',
    selectedToolIds,
    steps: [],
    createdToolFiles: [],
    actorToolAssignments: {
      executor: selectedToolIds,
      'web-search-agent': ['webmcp:search_web', 'webmcp:read_web_page'],
      [LOCAL_WEB_RESEARCH_AGENT_ID]: ['webmcp:local_web_research'],
    },
  };
}

describe('resolveExecutionRequirements local web research fan-in', () => {
  it('runs local research parallel to web search, logs AgentBus entries, and reranks merged evidence', async () => {
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
          title: 'Generic research tools overview',
          url: 'https://example.com/overview',
          snippet: 'A broad overview with weak entity evidence.',
        }],
      };
    });
    const localResearch = vi.fn(async ({ question }: { question: string }) => {
      events.push(`local-start:${question}`);
      releaseWebSearch();
      events.push('local-end');
      return {
        id: 'research-1',
        question,
        plannedQueries: [question],
        searchResults: [{
          id: 'search-1',
          title: 'SearXNG',
          url: 'https://docs.searxng.org/',
          normalizedUrl: 'https://docs.searxng.org',
          snippet: 'SearXNG is a free internet metasearch engine.',
          provider: 'searxng',
          rank: 1,
        }],
        extractedPages: [],
        evidence: [{
          id: 'evidence-1',
          url: 'https://docs.searxng.org/',
          normalizedUrl: 'https://docs.searxng.org',
          title: 'SearXNG',
          text: 'SearXNG is a free internet metasearch engine that aggregates results from search services.',
          score: 1,
          sourceResultId: 'search-1',
          citationId: 1,
        }],
        citations: [{
          id: 1,
          title: 'SearXNG',
          url: 'https://docs.searxng.org/',
          normalizedUrl: 'https://docs.searxng.org',
          quote: 'SearXNG is a free internet metasearch engine.',
        }],
        errors: [],
        timings: {},
        elapsedMs: 4,
        createdAt: '2026-04-30T00:00:00.000Z',
      };
    });
    const runtime: ToolAgentRuntime = {
      descriptors,
      tools: {
        'webmcp:search_web': { execute: search },
        'webmcp:local_web_research': { execute: localResearch },
        'webmcp:read_web_page': { execute: vi.fn() },
      } as unknown as ToolSet,
    };

    const result = await resolveExecutionRequirements({
      runtime,
      plan: plan(),
      messages: [{ role: 'user', content: 'search local web search agents' }],
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
      'web-start:search local web search agents',
      'local-start:search local web search agents',
      'local-end',
      'web-end',
    ]);
    expect(result.status).toBe('fulfilled');
    if (result.status !== 'fulfilled') {
      throw new Error(`Expected fulfilled result, got ${result.status}.`);
    }
    expect(result.result.text).toContain('[SearXNG](https://docs.searxng.org/)');
    expect(result.result.text).not.toContain('Generic research tools overview');

    const localToolEntry = busAppend.mock.calls
      .map(([payload]) => payload)
      .find((payload) => (
        payload.type === PayloadType.Result
        && String(payload.intentId).includes('webmcp-local_web_research')
      ));
    expect(localToolEntry?.meta).toMatchObject({
      actorId: LOCAL_WEB_RESEARCH_AGENT_ID,
      actorRole: 'search-agent',
      branchId: `agent:${LOCAL_WEB_RESEARCH_AGENT_ID}`,
      agentLabel: 'Local Web Research Agent',
      modelProvider: 'deterministic-local-web',
    });
    expect(busAppend.mock.calls.some(([payload]) => (
      payload.type === PayloadType.InfOut
      && payload.meta?.actorId === 'search-fan-in-merger'
      && String(payload.text).includes('web search and local web research')
    ))).toBe(true);
  });
});
