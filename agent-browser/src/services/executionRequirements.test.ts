import { describe, expect, it, vi } from 'vitest';
import type { ToolSet } from 'ai';
import { resolveExecutionRequirements } from './executionRequirements';
import type { ToolAgentRuntime, ToolPlan } from '../tool-agents/tool-agent';
import type { ToolDescriptor } from '../tools';

const descriptors: ToolDescriptor[] = [
  {
    id: 'webmcp:search_web',
    label: 'Search web',
    description: 'Search the public web for current and local facts.',
    group: 'built-in',
    groupLabel: 'Built-In',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'webmcp:read_web_page',
    label: 'Read web page',
    description: 'Read result pages and extract named entity evidence.',
    group: 'built-in',
    groupLabel: 'Built-In',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'cli',
    label: 'CLI',
    description: 'Run curl, node fetch, or shell commands.',
    group: 'built-in',
    groupLabel: 'Built-In',
  },
];

function plan(selectedToolIds = descriptors.map((descriptor) => descriptor.id)): ToolPlan {
  return {
    version: 1,
    goal: 'best movie theaters in Arlington Heights IL',
    selectedToolIds,
    steps: [],
    createdToolFiles: [],
    actorToolAssignments: {
      executor: selectedToolIds,
    },
  };
}

describe('resolveExecutionRequirements composite search provider fallback', () => {
  it('continues through registered providers instead of generating a shell HTML parser when web search is unavailable', async () => {
    const search = vi.fn(async ({ query }) => ({
      status: 'unavailable',
      query,
      reason: 'Web search returned 404.',
      results: [],
    }));
    const localWebResearch = vi.fn(async ({ maxPagesToExtract }) => ({
      id: 'research-theaters',
      question: 'what are the best movie theaters in Arlington Heights IL?',
      plannedQueries: ['best movie theaters Arlington Heights IL'],
      searchResults: [{
        id: 'local-amc',
        title: 'AMC Randhurst 12',
        url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
        normalizedUrl: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
        snippet: `AMC Randhurst 12 is a movie theater in Mount Prospect near Arlington Heights, IL. extracted:${maxPagesToExtract}`,
        provider: 'custom',
        rank: 1,
        score: 0.9,
      }],
      evidence: [{
        id: 'evidence-amc',
        title: 'AMC Randhurst 12',
        url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
        normalizedUrl: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
        text: 'AMC Randhurst 12 is a source-backed movie theater in Mount Prospect near Arlington Heights, IL.',
        score: 0.95,
      }],
      extractedPages: [],
      citations: [],
      errors: [],
      timings: {},
      elapsedMs: 1,
      createdAt: '2026-04-30T00:00:00.000Z',
    }));
    const cli = vi.fn();
    const readPage = vi.fn(async ({ url }) => ({
      status: 'read',
      url,
      title: 'AMC Randhurst 12',
      text: 'AMC Randhurst 12 is a movie theater in Mount Prospect near Arlington Heights, IL.',
      links: [],
      jsonLd: [{ '@type': 'MovieTheater', name: 'AMC Randhurst 12', url }],
      entities: [{ name: 'AMC Randhurst 12', url, evidence: 'json-ld' }],
      observations: [],
    }));
    const compositeDescriptors = [
      ...descriptors,
      {
        id: 'webmcp:local_web_research',
        label: 'Local web research',
        description: 'Search local SearXNG, crawl pages, and return cited evidence.',
        group: 'built-in' as const,
        groupLabel: 'Built-In',
        subGroup: 'web-search-mcp',
        subGroupLabel: 'Search',
      },
    ];
    const runtime: ToolAgentRuntime = {
      descriptors: compositeDescriptors,
      tools: {
        'webmcp:search_web': { execute: search },
        'webmcp:read_web_page': { execute: readPage },
        'webmcp:local_web_research': { execute: localWebResearch },
        cli: { execute: cli },
      } as unknown as ToolSet,
    };
    const busEntries: Array<{
      intentId?: string;
      meta?: {
        actorId?: string;
        actorRole?: string;
        parentActorId?: string;
        branchId?: string;
        agentLabel?: string;
        modelProvider?: string;
      };
    }> = [];
    const bus = {
      append: vi.fn(async (entry: unknown) => {
        busEntries.push(entry as (typeof busEntries)[number]);
      }),
    };
    const assignedToolIds = compositeDescriptors.map((descriptor) => descriptor.id);

    const result = await resolveExecutionRequirements({
      runtime,
      plan: plan(assignedToolIds),
      messages: [{ role: 'user', content: 'what are the best movie theaters in Arlington Heights IL?' }],
      executionContext: {
        bus: bus as never,
        toolPolicy: {
          allowedToolIds: assignedToolIds,
          assignments: {
            executor: assignedToolIds,
            'web-search-agent': assignedToolIds,
          },
        },
      },
      callbacks: {},
    });

    expect(result.status).toBe('fulfilled');
    if (result.status !== 'fulfilled') {
      throw new Error(`Expected fulfilled search fallback, got ${result.status}.`);
    }
    expect(search).toHaveBeenCalled();
    expect(localWebResearch).toHaveBeenCalledWith(expect.objectContaining({
      maxPagesToExtract: 3,
    }));
    expect(cli).not.toHaveBeenCalled();
    expect(result.result.text).toContain('AMC Randhurst 12');
    expect(result.result.needsUserInput).not.toBe(true);
    const searchResultEntry = busEntries.find((entry) => (
      entry.intentId === 'executor-tool-1-webmcp-search_web'
    ));
    expect(searchResultEntry?.meta).toMatchObject({
      actorId: 'search-agent',
      actorRole: 'search-agent',
      parentActorId: 'execute-plan',
      branchId: 'agent:search-agent',
      agentLabel: 'Search Agent',
      modelProvider: 'composite-search',
    });
    expect(searchResultEntry?.meta).not.toMatchObject({
      actorId: 'webmcp:search_web',
      branchId: 'agent:executor',
    });
    const searchValidationEntry = busEntries.find((entry) => (
      entry.intentId === 'validate-tool-call-1-webmcp-search_web'
    ));
    expect(searchValidationEntry?.meta).toMatchObject({
      actorId: 'validation-agent',
      parentActorId: 'search-agent',
      branchId: 'agent:search-agent',
    });
  });

  it('normalizes browser coordinates before local theater search and rejects source-section-only labels', async () => {
    const searchQueries: string[] = [];
    const readPage = vi.fn(async ({ url }: { url: string }) => ({
      status: 'read',
      url,
      title: 'Movie theaters near Arlington Heights, IL',
      text: [
        'Movie Times by Cities',
        'Cities Movie Times',
        'Movie Times by States',
        'States Movie Times',
        'Movie Times by Zip Codes',
        'Zip Codes Movie Times',
      ].join(' '),
      links: [
        { text: 'Cities Movie Times', url: 'https://www.fandango.com/movies-by-city' },
        { text: 'States Movie Times', url: 'https://www.fandango.com/movies-by-state' },
        { text: 'Zip Codes Movie Times', url: 'https://www.fandango.com/movies-by-zip-code' },
      ],
      jsonLd: [],
      entities: [
        { name: 'Cities Movie Times', url: 'https://www.fandango.com/movies-by-city', evidence: 'Movie Times by Cities' },
        { name: 'States Movie Times', url: 'https://www.fandango.com/movies-by-state', evidence: 'Movie Times by States' },
        { name: 'Zip Codes Movie Times', url: 'https://www.fandango.com/movies-by-zip-code', evidence: 'Movie Times by Zip Codes' },
      ],
      observations: [],
    }));
    const search = vi.fn(async ({ query }: { query: string }) => {
      searchQueries.push(query);
      if (query === 'city state for coordinates 42.12 -87.99') {
        return {
          status: 'found',
          query,
          results: [{
            title: '42.12, -87.99 - Arlington Heights, Illinois',
            url: 'https://fixtures.agent-browser.test/geocode/arlington-heights',
            snippet: 'Coordinates 42.12, -87.99 are in Arlington Heights, Illinois, United States.',
          }],
        };
      }
      if (query === 'nearby theaters Arlington Heights IL') {
        return {
          status: 'found',
          query,
          results: [{
            title: 'Movie Times and Movie Theaters in Arlington Heights, IL - Fandango',
            url: 'https://www.fandango.com/arlington-heights_il_movietimes',
            snippet: 'Find movie times and movie theaters near Arlington Heights, IL.',
          }],
        };
      }
      if (query === 'theaters names near Arlington Heights IL') {
        return {
          status: 'found',
          query,
          results: [
            {
              title: 'AMC Randhurst 12',
              url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
              snippet: 'AMC Randhurst 12 is a movie theater in Mount Prospect near Arlington Heights, IL.',
            },
            {
              title: 'CMX Arlington Heights',
              url: 'https://www.cmxcinemas.com/location/cmx-arlington-heights',
              snippet: 'CMX Arlington Heights is a cinema in Arlington Heights, IL.',
            },
          ],
        };
      }
      return { status: 'empty', query, results: [] };
    });
    const toolDescriptors: ToolDescriptor[] = [
      {
        id: 'webmcp:recall_user_context',
        label: 'Recall user context',
        description: 'Search app memory for saved city, neighborhood, or location.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'user-context-mcp',
        subGroupLabel: 'User Context',
      },
      {
        id: 'webmcp:read_browser_location',
        label: 'Read browser location',
        description: 'Read browser geolocation before asking the user.',
        group: 'built-in',
        groupLabel: 'Built-In',
        subGroup: 'user-context-mcp',
        subGroupLabel: 'User Context',
      },
      ...descriptors.filter((descriptor) => descriptor.id !== 'cli'),
    ];
    const selectedToolIds = toolDescriptors.map((descriptor) => descriptor.id);
    const runtime: ToolAgentRuntime = {
      descriptors: toolDescriptors,
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({ status: 'empty', query: 'location', memories: [] })),
        },
        'webmcp:read_browser_location': {
          execute: vi.fn(async () => ({
            status: 'available',
            latitude: 42.11713258868569,
            longitude: -87.9912774939386,
            accuracy: 24,
          })),
        },
        'webmcp:search_web': { execute: search },
        'webmcp:read_web_page': { execute: readPage },
      } as unknown as ToolSet,
    };

    const result = await resolveExecutionRequirements({
      runtime,
      plan: plan(selectedToolIds),
      messages: [{ role: 'user', content: 'show me theaters near me' }],
      executionContext: {
        toolPolicy: {
          allowedToolIds: selectedToolIds,
          assignments: { executor: selectedToolIds, 'web-search-agent': selectedToolIds },
        },
      },
      callbacks: {},
    });

    expect(searchQueries[0]).toBe('city state for coordinates 42.12 -87.99');
    expect(searchQueries).toContain('nearby theaters Arlington Heights IL');
    expect(searchQueries).toContain('theaters names near Arlington Heights IL');
    expect(searchQueries.join('\n')).not.toMatch(/42\.11713258868569|-87\.9912774939386|Cities Movie Times|States Movie Times|Zip Codes Movie Times/);
    expect(result.status).toBe('fulfilled');
    if (result.status !== 'fulfilled') {
      throw new Error(`Expected fulfilled coordinate-normalized theater search, got ${result.status}.`);
    }
    expect(result.context.location).toBe('Arlington Heights, IL');
    expect(result.context.searchQuery).toBe('nearby theaters Arlington Heights IL');
    expect(result.result.text).toContain('Here are theaters near Arlington Heights, IL');
    expect(result.result.text).toContain('[AMC Randhurst 12]');
    expect(result.result.text).toContain('[CMX Arlington Heights]');
    expect(result.result.text).not.toMatch(/42\.11713258868569|-87\.9912774939386|Cities Movie Times|States Movie Times|Zip Codes Movie Times/);
  });
});
