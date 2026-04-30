import { describe, expect, it } from 'vitest';
import { scoreCandidateLink } from '../links/scoreCandidateLink';
import { makeState, makeTask } from './helpers';

describe('scoreCandidateLink', () => {
  it('boosts authoritative docs, GitHub, and research links', () => {
    const state = makeState();
    const scored = scoreCandidateLink({
      link: { url: 'https://github.com/org/repo', normalizedUrl: 'https://github.com/org/repo', sourcePageUrl: 'https://example.com', anchorText: 'GitHub repo', score: 0, reason: '' },
      task: makeTask(),
      state,
    });

    expect(scored.score).toBeGreaterThanOrEqual(0.55);
    expect(scored.reason).toContain('authority');
  });

  it('penalizes unsafe, navigational, duplicate, and out-of-scope links', () => {
    const state = makeState({
      task: makeTask({ scope: { domains: ['docs.example.com'], excludedDomains: ['blocked.example.com'] } }),
      visited: [{ id: 'v1', targetId: 't1', kind: 'url', url: 'https://docs.example.com/login', normalizedUrl: 'https://docs.example.com/login', depth: 0, status: 'success', visitedAt: new Date(0).toISOString() }],
    });

    const duplicate = scoreCandidateLink({
      link: { url: 'https://docs.example.com/login', normalizedUrl: 'https://docs.example.com/login', sourcePageUrl: 'https://docs.example.com', anchorText: 'Sign in', score: 0, reason: '' },
      task: state.task,
      state,
    });
    const outOfScope = scoreCandidateLink({
      link: { url: 'https://blocked.example.com/docs', normalizedUrl: 'https://blocked.example.com/docs', sourcePageUrl: 'https://docs.example.com', anchorText: 'docs', score: 0, reason: '' },
      task: state.task,
      state,
    });

    expect(duplicate.score).toBe(0);
    expect(outOfScope.score).toBe(0);
  });
});
