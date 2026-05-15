import { describe, expect, it } from 'vitest';
import fixtures from './fixtures.json';

describe('cost routing contract fixtures', () => {
  it('includes required quality-gate scenarios', () => {
    const ids = new Set(fixtures.cases.map((c) => c.id));
    expect(ids).toEqual(new Set([
      'simple-stays-cheap',
      'complex-upgrades',
      'security-escalates',
      'misroute-regression-guard',
    ]));
  });
});
