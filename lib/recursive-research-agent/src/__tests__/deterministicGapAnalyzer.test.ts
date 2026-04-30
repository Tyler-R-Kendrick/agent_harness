import { describe, expect, it } from 'vitest';
import { DeterministicGapAnalyzer } from '../gaps/deterministicGapAnalyzer';
import { makeEvidence, makeTask } from './helpers';

describe('DeterministicGapAnalyzer', () => {
  it('creates gaps for unmet criteria, low diversity, freshness, and weak evidence', async () => {
    const analyzer = new DeterministicGapAnalyzer();
    const { gaps } = await analyzer.analyze({
      task: makeTask({ question: 'latest free local search approaches', successCriteria: ['metasearch', 'local indexing'] }),
      evidence: [makeEvidence({ url: 'https://one.example.com/a', normalizedUrl: 'https://one.example.com/a', text: 'Metasearch evidence from 2020.' })],
      claims: [],
      previousGaps: [],
      budgetRemaining: {},
    });

    expect(gaps.some((gap) => gap.description.includes('local indexing'))).toBe(true);
    expect(gaps.some((gap) => gap.description.includes('source diversity'))).toBe(true);
    expect(gaps.some((gap) => gap.description.includes('freshness'))).toBe(true);
    expect(gaps.every((gap) => gap.suggestedQueries.length > 0 && gap.reason)).toBe(true);
  });

  it('does not create high-priority gaps when criteria have strong diverse evidence', async () => {
    const analyzer = new DeterministicGapAnalyzer();
    const { gaps } = await analyzer.analyze({
      task: makeTask({ successCriteria: ['metasearch'] }),
      evidence: Array.from({ length: 4 }, (_, index) => makeEvidence({
        id: `e${index}`,
        url: `https://source${index}.example.com/a`,
        normalizedUrl: `https://source${index}.example.com/a`,
        text: 'metasearch cited evidence with limitations and extraction',
      })),
      claims: [],
      previousGaps: [],
      budgetRemaining: {},
    });

    expect(gaps.filter((gap) => gap.priority >= 0.6)).toHaveLength(0);
  });
});
