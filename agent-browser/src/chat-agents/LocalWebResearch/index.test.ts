import { describe, expect, it, vi } from 'vitest';
import {
  LOCAL_WEB_RESEARCH_AGENT_ID,
  LOCAL_WEB_RESEARCH_TOOL_ID,
  LocalWebResearchAgent,
  SearxngSearchProvider,
  buildLocalWebResearchAgentPrompt,
  buildCitations,
  chunkExtractedPages,
  evaluateLocalWebResearchAgentPolicy,
  normalizeUrl,
  planSearchQueries,
  rankEvidenceChunks,
  selectLocalWebResearchAgentTools,
} from '.';
import type { ToolDescriptor } from '../../tools';

const descriptors: ToolDescriptor[] = [
  {
    id: 'webmcp:local_web_research',
    label: 'Local web research',
    description: 'Search local SearXNG, extract pages, rank evidence, and return citations.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'webmcp:search_web',
    label: 'Search web',
    description: 'Search the public web.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'webmcp:elicit_user_input',
    label: 'Elicit user input',
    description: 'Ask the user for missing input.',
    group: 'built-in',
    groupLabel: 'Built-In',
  },
];

describe('Local Web Research Agent', () => {
  it('plans deterministic SearXNG queries and normalizes URLs safely', () => {
    expect(planSearchQueries('latest open source local web search agents')).toEqual([
      'latest open source local web search agents',
      'latest open source local web search agents 2026',
      'open source local web search agents',
    ]);
    expect(planSearchQueries('the best tools for web search')).toEqual([
      'the best tools for web search',
      'best tools web search',
    ]);

    expect(normalizeUrl('HTTPS://Example.COM/Path/?utm_source=x&keep=1#section')).toBe('https://example.com/Path?keep=1');
    expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path');
    expect(normalizeUrl('not a url')).toBe('not a url');
  });

  it('queries SearXNG JSON, deduplicates normalized URLs, and reports provider failures', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(url);
      expect(parsed.origin).toBe('http://localhost:8080');
      expect(parsed.pathname).toBe('/search');
      expect(parsed.searchParams.get('q')).toBe('local search agents');
      expect(parsed.searchParams.get('format')).toBe('json');
      expect(parsed.searchParams.get('categories')).toBe('general');
      expect(parsed.searchParams.get('language')).toBe('en');
      return new Response(JSON.stringify({
        results: [
          {
            title: 'Local Search Agents',
            url: 'https://example.com/research?utm_campaign=x',
            content: 'SearXNG and local extraction.',
            engine: 'duckduckgo',
            score: 1,
          },
          {
            title: 'Duplicate',
            url: 'https://example.com/research',
            content: 'Duplicate URL.',
          },
        ],
      }), { status: 200 });
    });
    const provider = new SearxngSearchProvider({ fetchImpl: fetchMock as never });

    await expect(provider.search({
      query: 'local search agents',
      maxResults: 10,
      language: 'en',
      freshness: 'week',
      safeSearch: true,
    })).resolves.toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^search-/),
        title: 'Local Search Agents',
        normalizedUrl: 'https://example.com/research',
        snippet: 'SearXNG and local extraction.',
        provider: 'searxng',
        engine: 'duckduckgo',
        rank: 1,
      }),
    ]);

    const failingProvider = new SearxngSearchProvider({
      fetchImpl: vi.fn(async () => new Response('nope', { status: 502, statusText: 'Bad Gateway' })) as never,
    });
    await expect(failingProvider.search({ query: 'x', maxResults: 1 }))
      .rejects.toThrow(/SearXNG returned HTTP 502/);
  });

  it('chunks, ranks, and cites extracted evidence deterministically', () => {
    const pages = [{
      id: 'page-1',
      url: 'https://example.com/a',
      normalizedUrl: 'https://example.com/a',
      title: 'Local web search agents',
      text: [
        'Local web search agents use SearXNG for metasearch and cite extracted pages.',
        'They should reject unsupported claims and preserve source URLs.',
        'Ranking should favor exact phrase matches in title and body.',
      ].join('\n\n'),
      length: 180,
      fetchedAt: '2026-04-30T00:00:00.000Z',
      sourceResultId: 'search-1',
    }];
    const chunks = chunkExtractedPages({ pages, maxChars: 90, overlapChars: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toMatchObject({
      url: 'https://example.com/a',
      normalizedUrl: 'https://example.com/a',
      title: 'Local web search agents',
      pageId: 'page-1',
      sourceResultId: 'search-1',
    });

    const ranked = rankEvidenceChunks({
      question: 'local web search agents',
      chunks: [
        { ...chunks[0], title: 'Other', text: 'generic unrelated text', score: 0 },
        { ...chunks[0], id: 'exact', text: 'local web search agents use SearXNG', score: 0 },
      ],
      maxChunks: 1,
    });
    expect(ranked).toEqual([expect.objectContaining({ id: 'exact', score: expect.any(Number) })]);

    const cited = buildCitations([
      { ...ranked[0], normalizedUrl: 'https://example.com/a' },
      { ...ranked[0], id: 'same-source', normalizedUrl: 'https://example.com/a' },
    ]);
    expect(cited.citations).toHaveLength(1);
    expect(cited.evidence.map((chunk) => chunk.citationId)).toEqual([1, 1]);
    expect(cited.citations[0].quote!.length).toBeLessThanOrEqual(280);
  });

  it('runs the full research workflow with recoverable extraction and synthesis errors', async () => {
    const searchProvider = {
      id: 'searxng',
      search: vi.fn(async () => [
        {
          id: 'search-1',
          title: 'Local web search agents',
          url: 'https://example.com/a',
          normalizedUrl: 'https://example.com/a',
          snippet: 'SearXNG local extraction evidence.',
          provider: 'searxng' as const,
          rank: 1,
        },
        {
          id: 'search-2',
          title: 'Broken page',
          url: 'https://example.com/b',
          normalizedUrl: 'https://example.com/b',
          snippet: 'This page fails extraction.',
          provider: 'searxng' as const,
          rank: 2,
        },
      ]),
    };
    const extractor = {
      extract: vi.fn(async ({ url, sourceResultId }: { url: string; sourceResultId?: string }) => {
        if (url.endsWith('/b')) throw new Error('blocked by site');
        return {
          id: 'page-a',
          url,
          normalizedUrl: normalizeUrl(url),
          title: 'Local web search agents',
          text: 'Local web search agents use SearXNG for search and page extraction for cited evidence. '.repeat(6),
          length: 480,
          fetchedAt: '2026-04-30T00:00:00.000Z',
          sourceResultId,
        };
      }),
    };
    const synthesizer = {
      synthesize: vi.fn(async () => {
        throw new Error('ollama offline');
      }),
    };
    const agent = new LocalWebResearchAgent({ searchProvider, extractor, synthesizer });

    const withoutSynthesis = await agent.run({ question: 'local web search agents', synthesize: false });
    expect(withoutSynthesis.answer).toBeUndefined();
    expect(withoutSynthesis.errors).toEqual([expect.objectContaining({
      stage: 'extracting',
      message: 'blocked by site',
      recoverable: true,
    })]);
    expect(withoutSynthesis.evidence.length).toBeGreaterThan(0);
    expect(withoutSynthesis.citations).toHaveLength(1);

    const withSynthesis = await agent.run({ question: 'local web search agents', synthesize: true });
    expect(withSynthesis.answer).toBeUndefined();
    expect(withSynthesis.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: 'synthesizing', message: 'ollama offline', recoverable: true }),
    ]));
    expect(synthesizer.synthesize).toHaveBeenCalled();
  });

  it('selects the local research tool and passes the static AgentEvals policy rubric', () => {
    const selectedToolIds = selectLocalWebResearchAgentTools(descriptors, 'latest local web search agents');
    const prompt = buildLocalWebResearchAgentPrompt({
      task: 'latest local web search agents',
      descriptors,
    });

    expect(LOCAL_WEB_RESEARCH_AGENT_ID).toBe('local-web-research-agent');
    expect(LOCAL_WEB_RESEARCH_TOOL_ID).toBe('webmcp:local_web_research');
    expect(selectedToolIds).toEqual(['webmcp:local_web_research']);
    expect(prompt).toContain('SearXNG');
    expect(prompt).toContain('Perplexity SDK');
    expect(prompt).toContain('Tavily SDK');
    expect(prompt).toContain('DuckDuckGo Instant');
    expect(prompt).toContain('secretRefs');
    expect(prompt).toContain('parallel to web-search-agent');
    expect(prompt).toContain('fan-in merge');
    expect(evaluateLocalWebResearchAgentPolicy({ prompt, selectedToolIds })).toEqual({
      passed: true,
      score: 1,
      checks: {
        usesLocalResearchTool: true,
        usesSearxngAndExtraction: true,
        supportsConfiguredProviders: true,
        resolvesSdkCredentialsWithSecretRefs: true,
        ranksEvidenceWithCitations: true,
        handlesRecoverableFailures: true,
        participatesInFanIn: true,
      },
    });
  });
});
