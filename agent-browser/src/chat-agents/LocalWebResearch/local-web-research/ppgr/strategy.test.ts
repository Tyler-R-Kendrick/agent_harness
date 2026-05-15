import { describe, expect, it } from 'vitest';
import { retrieveTextNodes, runPpgrStrategy } from './strategy';
import type { ExtractedPage } from '../types';

const page: ExtractedPage = {
  id: 'p1',
  url: 'https://example.com/paper',
  normalizedUrl: 'https://example.com/paper',
  text: `# Results\n\nThe battery benchmark improves latency and throughput for mobile clients in production settings.\n\nFigure 2. Latency curve under load with annotation for control and treatment.\n\nTable 1. Throughput comparison across cluster sizes.`,
  length: 240,
  fetchedAt: new Date().toISOString(),
};

describe('ppgr strategy', () => {
  it('retrieves section/paragraph text seeds', () => {
    const seeds = retrieveTextNodes([page], 'latency throughput battery benchmark');
    expect(seeds.length).toBeGreaterThan(0);
    expect(seeds.some((seed) => seed.text.includes('battery benchmark'))).toBe(true);
  });

  it('returns textual evidence and deduplicated pointer bundles within budget', () => {
    const out = runPpgrStrategy({
      question: 'latency throughput battery benchmark',
      pages: [page],
      maxEvidenceChunks: 2,
      maxPointerBudget: 1,
    });
    expect(out.evidence).toHaveLength(2);
    expect(out.pointerBundles).toHaveLength(1);
    expect(out.pointerBundles[0]?.pointerType).toMatch(/figure|table/);
  });
});
