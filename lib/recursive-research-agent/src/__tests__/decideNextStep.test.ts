import { describe, expect, it } from 'vitest';
import { decideNextStep } from '../decisions/decideNextStep';
import { makeEvidence, makeState, makeTarget } from './helpers';

describe('decideNextStep', () => {
  it('stops when sufficient or budget exhausted', () => {
    const sufficient = makeState({
      evidence: Array.from({ length: 6 }, (_, index) => makeEvidence({
        id: `e${index}`,
        url: `https://source${index}.example.com/a`,
        normalizedUrl: `https://source${index}.example.com/a`,
      })),
    });
    sufficient.frontier.add(makeTarget({ query: 'unused' }));
    const exhausted = makeState({ counters: { iterations: 4, searchQueriesExecuted: 0, urlsFetched: 0 } });
    exhausted.frontier.add(makeTarget());

    expect(decideNextStep(sufficient).action).toBe('stop');
    expect(decideNextStep(exhausted).reason).toContain('iteration');
  });

  it('searches deeper for high-priority gaps and changes strategy after redundancy', () => {
    const withGap = makeState({
      gaps: [{ id: 'gap-index', description: 'Need indexing', priority: 0.9, suggestedQueries: ['local indexing options'], suggestedDomains: ['github.com'], reason: 'criterion missing', status: 'open' }],
    });
    withGap.frontier.add(makeTarget());
    const redundant = makeState({
      metadata: { redundantIterations: 2, enableSemanticExpansion: true, enableLocalIndexSearch: true },
      evidence: [makeEvidence()],
    });
    redundant.frontier.add(makeTarget({ priority: 0.1, query: 'low' }));

    const gapDecision = decideNextStep(withGap);
    expect(gapDecision.action).toBe('search_deeper');
    expect('nextTargets' in gapDecision ? gapDecision.nextTargets.length : 0).toBeGreaterThan(0);
    expect(decideNextStep(redundant).action).toBe('change_strategy');
  });
});
