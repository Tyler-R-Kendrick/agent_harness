import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createSecretsManagerAgent, MemorySecretStore, secretRefForId } from '../../Secrets';
import {
  DuckDuckGoInstantSearchProvider,
  PerplexitySearchProvider,
  TavilySearchProvider,
  createSearchProviderFromConfig,
} from './searchProviders';

const now = '2026-04-30T00:00:00.000Z';

async function createSecretRefResolver(id: string, value: string) {
  const store = new MemorySecretStore();
  await store.set({
    id,
    value,
    label: id,
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  });
  const secrets = createSecretsManagerAgent({ store });
  return secrets.resolveSecretRefs.bind(secrets);
}

describe('web search providers', () => {
  it('searches Perplexity SDK with a resolved secretRef and normalized results', async () => {
    const resolveSecretRefs = await createSecretRefResolver('perplexity-key', 'pplx-secret-value');
    const createSearch = vi.fn(async () => ({
      results: [
        {
          title: 'Local Search Agents',
          url: 'https://example.com/research?utm_source=newsletter',
          snippet: 'Perplexity ranked result.',
          date: '2026-04-01',
        },
        {
          title: 'Duplicate',
          url: 'https://example.com/research',
          snippet: 'Duplicate URL.',
        },
      ],
    }));
    const clientFactory = vi.fn(async ({ apiKey }: { apiKey: string }) => ({
      apiKey,
      search: { create: createSearch },
    }));
    const provider = new PerplexitySearchProvider({
      apiKey: secretRefForId('perplexity-key'),
      resolveSecretRefs,
      clientFactory,
    });

    await expect(provider.search({ query: 'local search agents', maxResults: 5 })).resolves.toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^search-/),
        title: 'Local Search Agents',
        url: 'https://example.com/research?utm_source=newsletter',
        normalizedUrl: 'https://example.com/research',
        snippet: 'Perplexity ranked result.',
        provider: 'perplexity',
        rank: 1,
        publishedDate: '2026-04-01',
      }),
    ]);
    expect(clientFactory).toHaveBeenCalledWith({ apiKey: 'pplx-secret-value' });
    expect(createSearch).toHaveBeenCalledWith(expect.objectContaining({
      query: 'local search agents',
      max_results: 5,
    }));
  });

  it('searches Tavily SDK with a resolved secretRef and maps scores', async () => {
    const resolveSecretRefs = await createSecretRefResolver('tavily-key', 'tvly-secret-value');
    const sdkSearch = vi.fn(async () => ({
      results: [
        {
          title: 'Tavily Result',
          url: 'https://example.com/tavily?utm_campaign=x',
          content: 'Tavily content snippet.',
          score: 0.87,
          publishedDate: '2026-04-02',
        },
      ],
    }));
    const clientFactory = vi.fn(async ({ apiKey }: { apiKey: string }) => ({
      apiKey,
      search: sdkSearch,
    }));
    const provider = new TavilySearchProvider({
      apiKey: secretRefForId('tavily-key'),
      resolveSecretRefs,
      clientFactory,
    });

    await expect(provider.search({ query: 'sdk web search', maxResults: 3 })).resolves.toEqual([
      expect.objectContaining({
        title: 'Tavily Result',
        normalizedUrl: 'https://example.com/tavily',
        snippet: 'Tavily content snippet.',
        provider: 'tavily',
        score: 0.87,
        rank: 1,
        publishedDate: '2026-04-02',
      }),
    ]);
    expect(clientFactory).toHaveBeenCalledWith({ apiKey: 'tvly-secret-value' });
    expect(sdkSearch).toHaveBeenCalledWith('sdk web search', expect.objectContaining({
      maxResults: 3,
      searchDepth: 'basic',
      includeAnswer: false,
      includeRawContent: false,
    }));
  });

  it('searches DuckDuckGo Instant Answer API for free without credentials', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify({
      Heading: 'DuckDuckGo Instant Search',
      AbstractText: 'Instant answers summarize notable web entities.',
      AbstractURL: 'https://example.com/about?utm_source=duck',
      Results: [
        {
          Text: 'Agent Browser - Local web research provider',
          FirstURL: 'https://example.com/browser',
        },
      ],
      RelatedTopics: [
        {
          Text: 'Duplicate Browser - should be deduped',
          FirstURL: 'https://example.com/browser?utm_campaign=x',
        },
        {
          Name: 'Nested',
          Topics: [
            {
              Text: 'Nested Result - evidence result',
              FirstURL: 'https://example.com/nested',
            },
          ],
        },
      ],
    }), { status: 200 }));
    const provider = new DuckDuckGoInstantSearchProvider({ fetchImpl: fetchMock as never });

    const results = await provider.search({ query: 'agent browser local web research', maxResults: 10 });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0] ?? ''));
    expect(requestedUrl.origin).toBe('https://api.duckduckgo.com');
    expect(requestedUrl.searchParams.get('q')).toBe('agent browser local web research');
    expect(requestedUrl.searchParams.get('format')).toBe('json');
    expect(requestedUrl.searchParams.get('no_html')).toBe('1');
    expect(requestedUrl.searchParams.get('skip_disambig')).toBe('1');
    expect(results).toEqual([
      expect.objectContaining({
        title: 'DuckDuckGo Instant Search',
        normalizedUrl: 'https://example.com/about',
        snippet: 'Instant answers summarize notable web entities.',
        provider: 'duckduckgo-instant',
        rank: 1,
      }),
      expect.objectContaining({
        title: 'Agent Browser',
        normalizedUrl: 'https://example.com/browser',
        snippet: 'Agent Browser - Local web research provider',
        provider: 'duckduckgo-instant',
        rank: 2,
      }),
      expect.objectContaining({
        title: 'Nested Result',
        normalizedUrl: 'https://example.com/nested',
        snippet: 'Nested Result - evidence result',
        provider: 'duckduckgo-instant',
        rank: 3,
      }),
    ]);
  });

  it('builds providers from config and rejects missing SDK credentials', async () => {
    expect(createSearchProviderFromConfig({}).id).toBe('searxng');
    expect(createSearchProviderFromConfig({ searchProviderName: 'duckduckgo-instant' }).id)
      .toBe('duckduckgo-instant');

    const perplexity = createSearchProviderFromConfig({
      searchProviderName: 'perplexity',
      perplexityApiKey: secretRefForId('perplexity-key'),
    });
    expect(perplexity.id).toBe('perplexity');

    await expect(new TavilySearchProvider().search({ query: 'missing key', maxResults: 1 }))
      .rejects.toThrow(/TavilySearchProvider requires an apiKey/);
  });

  it('keeps Tavily on the SDK path with an explicit package patch', () => {
    const providerSource = readFileSync(
      path.resolve(process.cwd(), 'src/chat-agents/LocalWebResearch/local-web-research/searchProviders.ts'),
      'utf8',
    );
    const patchSource = readFileSync(
      path.resolve(process.cwd(), '../patches/@tavily+core+0.7.3.patch'),
      'utf8',
    );

    expect(providerSource).toContain("await import('@tavily/core')");
    expect(providerSource).not.toContain('createTavilyRestClient');
    expect(providerSource).not.toContain('importRuntimePackage');
    expect(patchSource).toContain('-import { HttpsProxyAgent } from "https-proxy-agent";');
    expect(patchSource).toContain('-import { encodingForModel } from "js-tiktoken";');
    expect(patchSource).toContain('createHttpsProxyAgent');
    expect(patchSource).toContain('loadEncodingForModel');
    expect(patchSource).toContain('readTavilyEnv');
  });
});
