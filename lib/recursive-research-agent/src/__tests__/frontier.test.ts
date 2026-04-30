import { describe, expect, it } from 'vitest';
import { FrontierQueue } from '../frontier/FrontierQueue';
import { addTargetIfAllowed } from '../frontier/addTargetIfAllowed';
import { scoreTarget } from '../frontier/scoreTarget';
import { makeState, makeTarget } from './helpers';

describe('FrontierQueue', () => {
  it('adds targets and returns highest priority first', () => {
    const queue = new FrontierQueue();
    queue.add(makeTarget({ id: 'low', priority: 0.2, query: 'low priority' }));
    queue.add(makeTarget({ id: 'high', priority: 0.9, query: 'high priority' }));

    expect(queue.nextBatch(2).map((target) => target.id)).toEqual(['high', 'low']);
    expect(queue.size()).toBe(0);
  });

  it('rejects duplicate equivalent queries and URLs', () => {
    const queue = new FrontierQueue();
    expect(queue.add(makeTarget({ id: 'q1', query: 'Free  Search Tools' }))).toBe(true);
    expect(queue.add(makeTarget({ id: 'q2', query: ' free search tools ' }))).toBe(false);
    expect(queue.add(makeTarget({ id: 'u1', kind: 'url', url: 'https://Example.com/docs/?utm_source=x#top' }))).toBe(true);
    expect(queue.add(makeTarget({ id: 'u2', kind: 'url', url: 'https://example.com/docs' }))).toBe(false);
  });

  it('enforces max size by retaining highest-priority targets', () => {
    const queue = new FrontierQueue({ maxSize: 2 });
    queue.addMany([
      makeTarget({ id: 'a', query: 'a', priority: 0.1 }),
      makeTarget({ id: 'b', query: 'b', priority: 0.9 }),
      makeTarget({ id: 'c', query: 'c', priority: 0.5 }),
    ]);

    expect(queue.list().map((target) => target.id)).toEqual(['b', 'c']);
  });

  it('enforces budget and scope before adding targets', () => {
    const state = makeState({
      task: makeState().task,
      visited: [{ id: 'v1', targetId: 'old', kind: 'url', url: 'https://seen.example.com/a', normalizedUrl: 'https://seen.example.com/a', depth: 0, status: 'success', visitedAt: new Date(0).toISOString() }],
      counters: { iterations: 0, searchQueriesExecuted: 8, urlsFetched: 0 },
    });

    expect(addTargetIfAllowed({ target: makeTarget({ id: 'too-deep', depth: 9 }), state })).toBe(false);
    expect(addTargetIfAllowed({ target: makeTarget({ id: 'query-budget', query: 'another query' }), state })).toBe(false);
    expect(addTargetIfAllowed({ target: makeTarget({ id: 'url-ok', kind: 'url', url: 'https://new.example.com/a' }), state })).toBe(true);
  });

  it('scores authoritative shallow gap-linked targets above duplicate saturated ones', () => {
    const state = makeState({
      gaps: [{ id: 'gap-docs', description: 'Need docs', priority: 0.9, suggestedQueries: ['docs'], reason: 'missing docs', status: 'open' }],
      visited: [
        { id: 'v1', targetId: 'a', kind: 'url', url: 'https://github.com/org/repo', normalizedUrl: 'https://github.com/org/repo', depth: 0, status: 'success', visitedAt: new Date(0).toISOString() },
        { id: 'v2', targetId: 'b', kind: 'url', url: 'https://github.com/org/repo/issues', normalizedUrl: 'https://github.com/org/repo/issues', depth: 0, status: 'success', visitedAt: new Date(0).toISOString() },
      ],
    });

    const official = scoreTarget({ target: makeTarget({ kind: 'url', url: 'https://docs.example.com/docs', reason: 'Addresses gap-docs', depth: 1 }), state });
    const duplicate = scoreTarget({ target: makeTarget({ query: 'Compare free self-hosted search tools for AI agents', depth: 2, priority: 0.2 }), state });

    expect(official).toBeGreaterThan(duplicate);
    expect(official).toBeLessThanOrEqual(1);
  });
});
