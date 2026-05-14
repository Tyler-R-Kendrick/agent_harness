import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('./searchProviders', () => ({
  createSearchProviderFromConfig: () => ({
    id: 'custom',
    search: async () => [],
  }),
}));

let LocalWebResearchAgent: typeof import('./agent').LocalWebResearchAgent;

beforeAll(async () => {
  ({ LocalWebResearchAgent } = await import('./agent'));
});

describe('LocalWebResearchAgent ppgr selector', () => {
  it('wires ppgr strategy and returns pointer bundles', async () => {
    const agent = new LocalWebResearchAgent({
      searchProvider: {
        id: 'custom',
        async search() {
          return [{ id: 'r1', title: 'x', url: 'https://example.com', normalizedUrl: 'https://example.com', provider: 'custom', rank: 1 }];
        },
      },
      extractor: {
        async extract() {
          return {
            id: 'p1',
            url: 'https://example.com',
            normalizedUrl: 'https://example.com',
            text: 'Results\n\nThis paragraph covers latency benchmark outcomes across production regions and compares baseline behavior.\n\nFigure 1. Latency comparison.',
            length: 100,
            fetchedAt: new Date().toISOString(),
          };
        },
      },
    });

    const result = await agent.run({ question: 'latency benchmark', retrievalStrategy: 'ppgr', maxPointerBudget: 1 });
    expect(result.pointerBundles?.length).toBe(1);
    expect(result.evidence.length).toBeGreaterThan(0);
  });
});
