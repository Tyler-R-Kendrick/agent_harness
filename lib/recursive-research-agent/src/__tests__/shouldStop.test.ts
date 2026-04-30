import { describe, expect, it } from 'vitest';
import { shouldStop } from '../decisions/shouldStop';
import { makeEvidence, makeState, makeTarget } from './helpers';

describe('shouldStop', () => {
  it('stops for max iterations, runtime, and empty frontier', () => {
    expect(shouldStop(makeState({ counters: { iterations: 4, searchQueriesExecuted: 0, urlsFetched: 0 } })).reason).toContain('iteration');
    expect(shouldStop(makeState({ startedAt: 0, deadlineAt: 1 })).reason).toContain('runtime');
    expect(shouldStop(makeState()).reason).toContain('frontier');
  });

  it('stops when sufficiency or query/fetch budgets are reached', () => {
    const enough = makeState({
      frontier: makeState().frontier,
      evidence: Array.from({ length: 6 }, (_, index) => makeEvidence({
        id: `e${index}`,
        url: `https://source${index}.example.com/a`,
        normalizedUrl: `https://source${index}.example.com/a`,
      })),
    });
    enough.frontier.add(makeTarget());

    const queryBudget = makeState({ counters: { iterations: 0, searchQueriesExecuted: 8, urlsFetched: 0 } });
    queryBudget.frontier.add(makeTarget({ kind: 'search_query', query: 'more' }));
    const fetchBudget = makeState({ counters: { iterations: 0, searchQueriesExecuted: 0, urlsFetched: 12 } });
    fetchBudget.frontier.add(makeTarget({ kind: 'url', url: 'https://example.com/a' }));

    expect(shouldStop(enough).reason).toContain('sufficiency');
    expect(shouldStop(queryBudget).reason).toContain('search query budget');
    expect(shouldStop(fetchBudget).reason).toContain('fetch budget');
  });
});
