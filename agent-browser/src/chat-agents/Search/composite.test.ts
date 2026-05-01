import { describe, expect, it, vi } from 'vitest';
import {
  COMPOSITE_SEARCH_AGENT_ID,
  CompositeSearchAgent,
  DefaultSearchCrawler,
  buildCompositeSearchAgentPrompt,
  compositeSearchResultToWebSearchResult,
  createDefaultSearchReranker,
  createSearchProviderAdapter,
  evaluateCompositeSearchAgentPolicy,
  selectCompositeSearchAgentTools,
} from '.';
import type { ToolDescriptor } from '../../tools';

const descriptors: ToolDescriptor[] = [
  {
    id: 'webmcp:search_web',
    label: 'Search web',
    description: 'Search the public web for current and local facts.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'webmcp:local_web_research',
    label: 'Local web research',
    description: 'Search SearXNG, crawl pages, rank evidence, and cite sources.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'webmcp:semantic_search',
    label: 'Semantic search',
    description: 'Search RDF/SPARQL endpoints with normalized semantic evidence.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'webmcp:read_web_page',
    label: 'Read web page',
    description: 'Read source pages and extract entity evidence.',
    group: 'web-search-mcp',
    groupLabel: 'Web Search',
    subGroup: 'web-search-mcp',
    subGroupLabel: 'Search',
  },
  {
    id: 'cli',
    label: 'CLI',
    description: 'Run general shell commands.',
    group: 'built-in',
    groupLabel: 'Built-In',
  },
];

describe('CompositeSearchAgent', () => {
  it('runs registered providers through one crawler plan, dedupes, and reranks results', async () => {
    const providerInputs: Array<{ providerId: string; maxPagesToExtract: number }> = [];
    const webProvider = createSearchProviderAdapter({
      id: 'web',
      label: 'Web search',
      kinds: ['web'],
      search: async (request) => {
        providerInputs.push({ providerId: 'web', maxPagesToExtract: request.contentPlan.maxPagesToExtract });
        return {
          status: 'found',
          query: request.query,
          results: [
            {
              title: 'Best Movie Theaters near Arlington Heights - Directory',
              url: 'https://example.com/directory',
              snippet: 'A directory result with AMC Randhurst 12 and other theaters.',
              rank: 1,
              score: 0.3,
            },
          ],
        };
      },
    });
    const localProvider = createSearchProviderAdapter({
      id: 'local-web',
      label: 'Local web research',
      kinds: ['local-web-research', 'crawler'],
      search: async (request) => {
        providerInputs.push({ providerId: 'local-web', maxPagesToExtract: request.contentPlan.maxPagesToExtract });
        return {
          status: 'found',
          query: request.query,
          results: [
            {
              title: 'AMC Randhurst 12',
              url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
              snippet: 'AMC Randhurst 12 is a movie theater in Mount Prospect near Arlington Heights, IL.',
              rank: 1,
              score: 0.86,
              metadata: { evidenceKind: 'crawled-page' },
            },
          ],
        };
      },
    });
    const rdfProvider = createSearchProviderAdapter({
      id: 'rdf',
      label: 'RDF semantic search',
      kinds: ['rdf'],
      search: async (request) => {
        providerInputs.push({ providerId: 'rdf', maxPagesToExtract: request.contentPlan.maxPagesToExtract });
        return {
          status: 'found',
          query: request.query,
          results: [
            {
              title: 'AMC Randhurst 12',
              url: 'https://www.amctheatres.com/movie-theatres/chicago/amc-randhurst-12',
              snippet: 'Wikidata source-backed movie theater entity.',
              rank: 1,
              score: 0.72,
            },
          ],
        };
      },
    });

    const agent = new CompositeSearchAgent({
      providers: [webProvider, localProvider, rdfProvider],
      crawler: new DefaultSearchCrawler(),
      reranker: createDefaultSearchReranker({
        providerWeights: { 'local-web': 0.25, rdf: 0.1, web: 0 },
      }),
    });

    const result = await agent.search({
      question: 'what are the best movie theaters near me?',
      query: 'best movie theaters Arlington Heights IL',
      subject: 'movie theaters',
      location: 'Arlington Heights, IL',
      rankingGoal: 'best',
      limit: 3,
    });

    expect(result.status).toBe('found');
    expect(result.contentPlan).toEqual({
      depth: 2,
      maxPagesToExtract: 3,
      reason: 'Local or ranked search needs crawled source evidence before answer selection.',
    });
    expect(providerInputs).toEqual([
      { providerId: 'web', maxPagesToExtract: 3 },
      { providerId: 'local-web', maxPagesToExtract: 3 },
      { providerId: 'rdf', maxPagesToExtract: 3 },
    ]);
    expect(result.results.map((item) => item.title)).toEqual([
      'AMC Randhurst 12',
      'Best Movie Theaters near Arlington Heights - Directory',
    ]);
    expect(result.results[0].providerIds).toEqual(['local-web', 'rdf']);
  });

  it('surfaces unavailable providers while preserving successful provider evidence', async () => {
    const unavailable = createSearchProviderAdapter({
      id: 'web',
      label: 'Web search',
      kinds: ['web'],
      search: async (request) => ({
        status: 'unavailable',
        query: request.query,
        results: [],
        errors: [{ providerId: 'web', message: 'Web search returned 404.', recoverable: true }],
      }),
    });
    const semantic = createSearchProviderAdapter({
      id: 'rdf',
      label: 'RDF semantic search',
      kinds: ['rdf'],
      search: async (request) => ({
        status: 'found',
        query: request.query,
        results: [{
          title: 'Douglas Adams',
          url: 'https://www.wikidata.org/wiki/Q42',
          snippet: 'Wikidata entity result.',
          rank: 1,
          score: 0.9,
        }],
      }),
    });

    const result = await new CompositeSearchAgent({ providers: [unavailable, semantic] }).search({
      question: 'facts about Douglas Adams',
      query: 'Douglas Adams Q42',
      subject: 'facts',
      limit: 5,
    });

    expect(result.status).toBe('found');
    expect(result.errors).toEqual([{ providerId: 'web', message: 'Web search returned 404.', recoverable: true }]);
    expect(result.results[0]).toMatchObject({ title: 'Douglas Adams', providerIds: ['rdf'] });
  });

  it('returns an unavailable composite result when no registered provider can run', async () => {
    const disabled = createSearchProviderAdapter({
      id: 'web',
      label: 'Web search',
      kinds: ['web'],
      isEnabled: () => false,
      search: vi.fn(),
    });

    await expect(new CompositeSearchAgent({ providers: [disabled] }).search({
      question: 'anything current',
      query: 'anything current',
      limit: 3,
    })).resolves.toMatchObject({
      status: 'unavailable',
      query: 'anything current',
      results: [],
      errors: [{ providerId: 'composite-search', message: 'No search providers are enabled for this request.', recoverable: true }],
    });
  });

  it.each([
    ['best restaurants near me', 'restaurants Arlington Heights IL', { depth: 2, maxPagesToExtract: 5 }],
    ['current release date for TypeScript', 'TypeScript release date', { depth: 1, maxPagesToExtract: 2 }],
    ['Douglas Adams Q42', 'Douglas Adams Q42', { depth: 0, maxPagesToExtract: 0 }],
  ])('plans crawler depth for %s', (question, query, expected) => {
    expect(new DefaultSearchCrawler().plan({
      question,
      query,
      subject: 'facts',
      location: question.includes('near me') ? 'Arlington Heights, IL' : undefined,
      limit: 5,
    })).toMatchObject(expected);
  });

  it('converts composite results back to the existing web-search result shape', async () => {
    const result = await new CompositeSearchAgent({
      providers: [
        createSearchProviderAdapter({
          id: 'web',
          label: 'Web search',
          kinds: ['web'],
          search: async (request) => ({
            status: 'found',
            query: request.query,
            results: [{ title: 'Result', url: 'https://example.com', snippet: 'Snippet', rank: 1 }],
          }),
        }),
      ],
    }).search({ question: 'find result', query: 'find result', limit: 3 });

    expect(compositeSearchResultToWebSearchResult(result)).toEqual({
      status: 'found',
      query: 'find result',
      results: [{ title: 'Result', url: 'https://example.com', snippet: 'Snippet' }],
    });
  });
});

describe('Composite search-agent policy', () => {
  it('selects provider tools without selecting generic CLI as a search implementation', () => {
    expect(selectCompositeSearchAgentTools(descriptors, 'movie theaters near me')).toEqual([
      'webmcp:search_web',
      'webmcp:local_web_research',
      'webmcp:semantic_search',
      'webmcp:read_web_page',
    ]);
  });

  it('passes the AgentEvals-style policy rubric for provider registry, crawler depth, and reranking', () => {
    const selectedToolIds = selectCompositeSearchAgentTools(descriptors, 'best theaters near me');
    const prompt = buildCompositeSearchAgentPrompt({
      task: 'best theaters near me',
      descriptors,
      location: 'Arlington Heights, IL',
    });

    expect(COMPOSITE_SEARCH_AGENT_ID).toBe('search-agent');
    expect(prompt).toContain('provider registry');
    expect(prompt).toContain('webmcp:search_web');
    expect(prompt).toContain('webmcp:local_web_research');
    expect(prompt).toContain('webmcp:semantic_search');
    expect(prompt).toContain('crawler depth');
    expect(prompt).toContain('reranking');
    expect(evaluateCompositeSearchAgentPolicy({ prompt, selectedToolIds })).toEqual({
      passed: true,
      score: 1,
      checks: {
        usesProviderRegistry: true,
        includesWebProvider: true,
        includesLocalResearchProvider: true,
        includesRdfProvider: true,
        usesCrawlerDepth: true,
        usesDynamicReranking: true,
        avoidsGenericCliParsing: true,
      },
    });
  });
});
