import { describe, expect, it, vi } from 'vitest';
import type { ToolSet } from 'ai';
import { PayloadType, type Payload } from 'logact';
import { runConfiguredExecutorAgent } from '../../src/services/executorAgent';
import type { LogActActorExecuteContext } from '../../src/services/logactActorWorkflow';
import type { ToolDescriptor } from '../../src/tools';
import type { ToolAgentRuntime, ToolPlan } from '../../src/tool-agents/tool-agent';

const descriptors: ToolDescriptor[] = [
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
    id: 'webmcp:search_web',
    label: 'Search web',
    description: 'Search the web for external facts and local recommendations.',
    group: 'built-in',
    groupLabel: 'Built-In',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'webmcp:read_web_page',
    label: 'Read web page',
    description: 'Read and extract evidence from a search result page.',
    group: 'built-in',
    groupLabel: 'Built-In',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
];

const plan: ToolPlan = {
  version: 1,
  goal: "what're the best movie theaters near me?",
  selectedToolIds: descriptors.map((descriptor) => descriptor.id),
  steps: [],
  createdToolFiles: [],
  actorToolAssignments: { executor: descriptors.map((descriptor) => descriptor.id) },
};

describe('search fulfillment deterministic evals', () => {
  it('uses real AgentV/AgentEvals scoring instead of the deleted local judge shim', async () => {
    const { buildAgentvSearchEvalCommand } = await import('../../scripts/run-agentv-search-eval.mjs');
    const command = buildAgentvSearchEvalCommand({ live: false });

    expect(command.packageName).toBe('agentv');
    expect(command.args).toEqual(expect.arrayContaining([
      'eval',
      'run',
      'agent-browser/evals/search-fulfillment/EVAL.yaml',
      '--target',
      'agent-browser-search-fulfillment',
    ]));
  });

  it('recovers from the reported movie-theater page-chrome failure with targeted discovery', async () => {
    const searchQueries: string[] = [];
    const busAppend = vi.fn(async (_payload: Payload) => ({ id: 'entry' }));
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({
            status: 'found',
            query: 'location',
            memories: [{
              id: 'location.city',
              label: 'Saved city',
              value: 'Arlington Heights, IL',
              source: 'workspace-memory',
              updatedAt: '2026-04-26T00:00:00.000Z',
            }],
          })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            if (query === 'best movie theaters Arlington Heights IL') {
              return {
                status: 'found',
                query,
                results: [
                  {
                    title: 'Movie Showtimes and Theaters near Arlington Heights, IL',
                    url: 'https://www.fandango.com/arlington-heights_il_movietimes',
                    snippet: 'Discover showtimes and movie theaters near you with Fandango in Arlington Heights, IL.',
                  },
                  {
                    title: 'Movie theaters and showtimes near 60004, Arlington Heights, IL',
                    url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/',
                    snippet: 'Local Movie Times and Movie Theaters near 60004, Arlington Heights, IL.',
                  },
                ],
              };
            }
            return {
              status: 'found',
              query,
              results: [
                {
                  title: 'AMC Randhurst 12 - AMC Theatres',
                  url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
                  snippet: 'AMC Randhurst 12 is a movie theater at Randhurst Village in Mount Prospect near Arlington Heights, IL.',
                },
                {
                  title: 'CMX Arlington Heights - CMX Cinemas',
                  url: 'https://www.cmxcinemas.com/location/cmx-arlington-heights',
                  snippet: 'CMX Arlington Heights is a movie theater at 53 S Evergreen Ave in Arlington Heights, IL.',
                },
                {
                  title: 'Classic Cinemas Elk Grove Theatre',
                  url: 'https://www.classiccinemas.com/elk-grove',
                  snippet: 'Classic Cinemas Elk Grove Theatre is a movie theater in Elk Grove Village near Arlington Heights, IL.',
                },
              ],
            };
          }),
        },
        'webmcp:read_web_page': {
          execute: vi.fn(async ({ url }: { url: string }) => ({
            status: 'read',
            url,
            title: 'Showtimes page chrome',
            text: 'At Home. Movie Charts. Movie News. FanStore. Streaming. Coming Soon.',
            links: [
              { text: 'At Home', url: 'https://www.fandango.com/watch-at-home' },
              { text: 'Movie Charts', url: 'https://www.fandango.com/movie-charts' },
              { text: 'Movie News', url: 'https://www.fandango.com/movie-news' },
            ],
            jsonLd: [],
            entities: [
              { name: 'At Home', url: 'https://www.fandango.com/watch-at-home', evidence: 'page link' },
              { name: 'Movie Charts', url: 'https://www.fandango.com/movie-charts', evidence: 'page link' },
              { name: 'Movie News', url: 'https://www.fandango.com/movie-news', evidence: 'page link' },
            ],
          })),
        },
      } as unknown as ToolSet,
      descriptors,
    };

    const result = await runConfiguredExecutorAgent({
      model: { provider: 'test', modelId: 'eval-model' } as never,
      tools: runtime.tools,
      toolDescriptors: descriptors,
      instructions: 'Evaluate deterministic search fulfillment.',
      messages: [{ role: 'user' as const, content: "what're the best movie theaters near me?" }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
      runtime,
    }, plan, descriptors, runtime.tools, {}, {
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((descriptor) => descriptor.id),
        assignments: { executor: descriptors.map((descriptor) => descriptor.id) },
      },
      plan,
      selectedDescriptors: descriptors,
      selectedTools: runtime.tools,
      bus: { append: busAppend } as unknown as LogActActorExecuteContext['bus'],
      busEntries: [],
    });

    expect(searchQueries).toEqual([
      'best movie theaters Arlington Heights IL',
      'movie theaters names near Arlington Heights IL',
    ]);
    expect(result.text).toContain('[AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12)');
    expect(result.text).toContain('[CMX Arlington Heights](https://www.cmxcinemas.com/location/cmx-arlington-heights)');
    expect(result.text).toContain('[Classic Cinemas Elk Grove Theatre](https://www.classiccinemas.com/elk-grove)');
    expect(result.text).not.toMatch(/^\s*\d+\.\s+\[(?:At Home|Movie Charts|Movie News)\]/im);
    const structuredCandidateResults = busAppend.mock.calls
      .map(([payload]) => payload)
      .filter((payload): payload is Extract<Payload, { type: PayloadType.Result }> => (
        payload.type === PayloadType.Result
        && payload.meta?.actorId === 'search-analyzer'
        && String(payload.intentId).includes('validated-candidates')
      ));
    const candidatePayload = JSON.parse(structuredCandidateResults.at(-1)?.output ?? '{}') as {
      candidates?: Array<{ name: string }>;
      rejected?: Array<{ name: string }>;
    };
    expect(candidatePayload.candidates?.map((candidate) => candidate.name)).toEqual(expect.arrayContaining([
      'AMC Randhurst 12',
      'CMX Arlington Heights',
      'Classic Cinemas Elk Grove Theatre',
    ]));
    expect(candidatePayload.rejected?.map((candidate) => candidate.name)).toEqual(expect.arrayContaining([
      'At Home',
      'Movie Charts',
      'Movie News',
    ]));
  });

  it('movie theater search renders actual nearby theater names, not source page chrome', async () => {
    const searchQueries: string[] = [];
    const busAppend = vi.fn(async (_payload: Payload) => ({ id: 'entry' }));
    const runtime: ToolAgentRuntime = {
      tools: {
        'webmcp:recall_user_context': {
          execute: vi.fn(async () => ({
            status: 'found',
            query: 'location',
            memories: [{
              id: 'location.city',
              label: 'Saved city',
              value: 'Arlington Heights, IL',
              source: 'workspace-memory',
              updatedAt: '2026-04-26T00:00:00.000Z',
            }],
          })),
        },
        'webmcp:search_web': {
          execute: vi.fn(async ({ query }: { query: string }) => {
            searchQueries.push(query);
            return {
              status: 'found',
              query,
              results: [
                {
                  title: 'Movie Showtimes and Theaters near Arlington Heights, IL',
                  url: 'https://www.fandango.com/arlington-heights_il_movietimes',
                  snippet: 'Discover showtimes and movie theaters near you with Fandango in Arlington Heights, IL.',
                },
                {
                  title: 'Movie theaters and showtimes near 60004, Arlington Heights, IL',
                  url: 'https://www.moviefone.com/showtimes/theaters/arlington-heights-il/60004/',
                  snippet: 'Local Movie Times and Movie Theaters near 60004, Arlington Heights, IL.',
                },
              ],
            };
          }),
        },
        'webmcp:read_web_page': {
          execute: vi.fn(async ({ url }: { url: string }) => {
            if (url.includes('fandango')) {
              return {
                status: 'read',
                url,
                title: 'Movie Theaters near Arlington Heights',
                text: 'At Home. Streaming. Coming Soon. AMC Randhurst 12 movie theater at Randhurst Village in Mount Prospect near Arlington Heights. CMX Arlington Heights movie theater at 53 S Evergreen Ave in Arlington Heights.',
                links: [
                  { text: 'At Home', url: 'https://www.fandango.com/watch-at-home' },
                  { text: 'Streaming', url: 'https://www.fandango.com/streaming' },
                  { text: 'Coming Soon', url: 'https://www.fandango.com/coming-soon' },
                  { text: 'AMC Randhurst 12', url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12' },
                  { text: 'CMX Arlington Heights', url: 'https://www.cmxcinemas.com/location/cmx-arlington-heights' },
                ],
                jsonLd: [],
                entities: [
                  { name: 'At Home', url: 'https://www.fandango.com/watch-at-home', evidence: 'page link' },
                  { name: 'Streaming', url: 'https://www.fandango.com/streaming', evidence: 'page link' },
                  { name: 'Coming Soon', url: 'https://www.fandango.com/coming-soon', evidence: 'page link' },
                  { name: 'AMC Randhurst 12', url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12', evidence: 'movie theater listing at Randhurst Village in Mount Prospect near Arlington Heights' },
                  { name: 'CMX Arlington Heights', url: 'https://www.cmxcinemas.com/location/cmx-arlington-heights', evidence: 'movie theater listing at 53 S Evergreen Ave in Arlington Heights, IL' },
                ],
              };
            }
            return {
              status: 'read',
              url,
              title: 'Cinema near Arlington Heights',
              text: 'Classic Cinemas Elk Grove Theatre is a movie theater in Elk Grove Village near Arlington Heights.',
              links: [{ text: 'Classic Cinemas Elk Grove Theatre', url: 'https://www.classiccinemas.com/elk-grove' }],
              jsonLd: [],
              entities: [
                { name: 'Classic Cinemas Elk Grove Theatre', url: 'https://www.classiccinemas.com/elk-grove', evidence: 'movie theater listing in Elk Grove Village near Arlington Heights' },
              ],
            };
          }),
        },
      } as unknown as ToolSet,
      descriptors,
    };

    const result = await runConfiguredExecutorAgent({
      model: { provider: 'test', modelId: 'eval-model' } as never,
      tools: runtime.tools,
      toolDescriptors: descriptors,
      instructions: 'Evaluate deterministic search fulfillment.',
      messages: [{ role: 'user' as const, content: "what're the best movie theaters near me?" }],
      workspaceName: 'Research',
      capabilities: { contextWindow: 2048, maxOutputTokens: 256 },
      runtime,
    }, plan, descriptors, runtime.tools, {}, {
      action: 'Use AgentBus instructions to answer the current nearby search request.',
      toolPolicy: {
        allowedToolIds: descriptors.map((descriptor) => descriptor.id),
        assignments: { executor: descriptors.map((descriptor) => descriptor.id) },
      },
      plan,
      selectedDescriptors: descriptors,
      selectedTools: runtime.tools,
      bus: { append: busAppend } as unknown as LogActActorExecuteContext['bus'],
      busEntries: [],
    });

    expect(searchQueries[0]).toBe('best movie theaters Arlington Heights IL');
    expect(result.text).toContain('[AMC Randhurst 12](https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12)');
    expect(result.text).toContain('Mount Prospect');
    expect(result.text).toContain('[CMX Arlington Heights](https://www.cmxcinemas.com/location/cmx-arlington-heights)');
    expect(result.text).toContain('Arlington Heights');
    expect(result.text).toContain('[Classic Cinemas Elk Grove Theatre](https://www.classiccinemas.com/elk-grove)');
    expect(result.text).toContain('Elk Grove Village');
    expect(result.text).not.toMatch(/^\s*\d+\.\s+\[(?:At Home|Streaming|Coming Soon)\]/im);
    expect(busAppend.mock.calls.some(([payload]) => (
      payload.type === PayloadType.Result
      && payload.meta?.actorId === 'search-analyzer'
      && String(payload.intentId).includes('validated-candidates')
    ))).toBe(true);
  });
});
