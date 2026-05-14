import { describe, expect, it } from 'vitest';

import type { ExtractedPage } from '../types';
import { buildStructureGraph } from './buildStructureGraph';

const page: ExtractedPage = {
  id: 'page-1',
  url: 'https://example.com/report',
  normalizedUrl: 'https://example.com/report',
  text: [
    '# Performance',
    '',
    'This section summarizes the release. Figure 2: Throughput trend.',
    '',
    'It also compares prior baselines for context.',
    '',
    '## Reliability',
    '',
    'Table 4 - Error rates by region',
  ].join('\n'),
  length: 120,
  fetchedAt: '2026-05-14T00:00:00.000Z',
  title: 'Example Report',
};

describe('buildStructureGraph', () => {
  it('builds deterministic section and paragraph-first graph', () => {
    const first = buildStructureGraph(page);
    const second = buildStructureGraph(page);

    expect(first).toEqual(second);
    expect(first.nodes.filter((node) => node.kind === 'section').length).toBeGreaterThanOrEqual(2);
    expect(first.nodes.some((node) => node.kind === 'paragraph')).toBe(true);
    expect(first.edges.some((edge) => edge.type === 'contains')).toBe(true);
    expect(first.edges.some((edge) => edge.type === 'near')).toBe(true);
  });

  it('extracts figure and table references with deterministic references edges', () => {
    const graph = buildStructureGraph(page);
    const figureNodes = graph.nodes.filter((node) => node.kind === 'figure');
    const tableNodes = graph.nodes.filter((node) => node.kind === 'table');

    expect(figureNodes).toHaveLength(1);
    expect(tableNodes).toHaveLength(1);

    for (const pointer of [...figureNodes, ...tableNodes]) {
      expect(graph.edges.some((edge) => edge.to === pointer.id && edge.type === 'references')).toBe(true);
    }
  });
});
