import { describe, expect, it } from 'vitest';

import {
  buildDemoCorpus,
  retrieveTextNodes,
  runProxyPointerQuery,
  scoreText,
} from './experiment-01-proxy-pointer';

describe('proxy-pointer retrieval scaffold', () => {
  it('scores overlap higher for matching text', () => {
    expect(scoreText('revenue growth chart', 'quarterly revenue growth chart')).toBeGreaterThan(0);
    expect(scoreText('revenue growth chart', 'unrelated paragraph')).toBe(0);
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
});
