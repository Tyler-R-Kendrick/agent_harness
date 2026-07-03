import { describe, expect, it } from 'vitest';
import { SeededLcg } from '../rng';

describe('SeededLcg', () => {
  it('produces values within the requested half-open range', () => {
    const rng = new SeededLcg(12345);
    for (let i = 0; i < 100; i += 1) {
      const value = rng.nextInt(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('is deterministic: two instances with the same seed yield the same sequence', () => {
    const a = new SeededLcg(2605);
    const b = new SeededLcg(2605);
    const seqA = [a.nextInt(1000), a.nextInt(1000), a.nextInt(1000)];
    const seqB = [b.nextInt(1000), b.nextInt(1000), b.nextInt(1000)];
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededLcg(1);
    const b = new SeededLcg(2);
    expect(a.nextInt(1_000_000)).not.toBe(b.nextInt(1_000_000));
  });
});
