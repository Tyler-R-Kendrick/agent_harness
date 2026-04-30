import { describe, expect, it } from 'vitest';
import { generateFollowUpTargets } from '../queries/generateFollowUpTargets';
import { makeState } from './helpers';

describe('generateFollowUpTargets', () => {
  it('converts gaps into bounded query, domain, and URL targets with trace metadata', () => {
    const state = makeState({ counters: { iterations: 1, searchQueriesExecuted: 0, urlsFetched: 0 } });
    const targets = generateFollowUpTargets({
      state,
      gaps: [{
        id: 'gap-indexing',
        description: 'Need indexing options',
        priority: 0.85,
        suggestedQueries: ['self hosted indexing search', 'YaCy Common Crawl local index', 'extra query ignored'],
        suggestedDomains: ['github.com'],
        suggestedUrls: ['https://docs.example.com/indexing'],
        reason: 'Current evidence misses indexing',
        status: 'open',
      }],
    });

    expect(targets.map((target) => target.kind)).toEqual(['search_query', 'search_query', 'domain_search', 'url']);
    expect(targets.every((target) => target.reason && target.priority > 0 && target.depth === 1 && target.parentId === 'gap-indexing')).toBe(true);
  });
});
