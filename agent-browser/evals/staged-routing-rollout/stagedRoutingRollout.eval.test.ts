import { describe, expect, it } from 'vitest';
import fixtures from './fixtures.json';

describe('staged routing rollout fixtures', () => {
  it('covers misroute prevention, cost win, and policy invariants', () => {
    const ids = new Set(fixtures.cases.map((entry) => entry.id));
    expect(ids).toEqual(new Set([
      'misroute-prevention-complex',
      'misroute-prevention-escalation',
      'cost-win-simple',
      'policy-invariants',
    ]));
  });
});
