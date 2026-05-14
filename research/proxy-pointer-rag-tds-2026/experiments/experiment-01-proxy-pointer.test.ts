import { describe, expect, it } from 'vitest';

import {
  buildDemoCorpus,
  expandPointers,
  retrieveTextNodes,
  runProxyPointerQuery,
  scoreText,
} from './experiment-01-proxy-pointer';

describe('proxy-pointer retrieval scaffold', () => {
  it('scores overlap higher for matching text', () => {
    expect(scoreText('revenue growth chart', 'quarterly revenue growth chart')).toBeGreaterThan(0);
    expect(scoreText('revenue growth chart', 'unrelated paragraph')).toBe(0);
  });

  it('returns zero for empty scoring inputs', () => {
    expect(scoreText('', 'quarterly revenue growth chart')).toBe(0);
    expect(scoreText('revenue growth chart', '')).toBe(0);
  });

  it('retrieves relevant text seed nodes', () => {
    const corpus = buildDemoCorpus();
    const nodes = retrieveTextNodes(corpus, 'latency table statistics', 2);
    expect(nodes.some((node) => node.id === 'p2')).toBe(true);
  });

  it('expands to chart pointer for chart query', () => {
    const corpus = buildDemoCorpus();
    const results = runProxyPointerQuery(corpus, 'show quarterly revenue chart');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.nodeId).toBe('f1');
    expect(results[0]?.assetUri).toContain('figure-1.png');
  });

  it('expands to table pointer for latency query', () => {
    const corpus = buildDemoCorpus();
    const results = runProxyPointerQuery(corpus, 'what is p95 latency in the table');

    const table = results.find((bundle) => bundle.nodeId === 't1');
    expect(table).toBeDefined();
    expect(table?.kind).toBe('table');
    expect(table?.page).toBe(3);
  });

  it('ignores pointer edges without usable figure or table assets', () => {
    const corpus = buildDemoCorpus();
    const seeds = retrieveTextNodes(corpus, 'revenue analysis', 1);
    const results = expandPointers(
      {
        ...corpus,
        edges: [
          { from: 'missing-seed', to: 'f1', type: 'references' },
          { from: 's1', to: 'missing-target', type: 'references' },
          { from: 's1', to: 'p1', type: 'contains' },
        ],
      },
      'revenue analysis',
      seeds,
    );

    expect(results).toEqual([]);
  });

  it('keeps the best scored pointer when duplicate edges reach one asset', () => {
    const corpus = buildDemoCorpus();
    const paragraph = corpus.nodes.find((node) => node.id === 'p1');
    const section = corpus.nodes.find((node) => node.id === 's1');

    expect(paragraph).toBeDefined();
    expect(section).toBeDefined();

    const results = expandPointers(
      {
        ...corpus,
        edges: [
          { from: 'p1', to: 'f1', type: 'references' },
          { from: 's1', to: 'f1', type: 'contains' },
        ],
      },
      'revenue growth chart',
      [paragraph!, section!],
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.nodeId).toBe('f1');
    expect(results[0]?.score).toBeGreaterThan(1);
  });
});
