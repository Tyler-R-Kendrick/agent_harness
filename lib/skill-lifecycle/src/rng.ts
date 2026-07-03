/**
 * Tiny seeded linear-congruential generator (LCG) for deterministic sampling.
 *
 * Deliberately avoids `Math.random()` so that proposal sampling in
 * {@link ./evalGate} is fully reproducible from a seed. Uses the Numerical
 * Recipes LCG constants.
 */
export class SeededLcg {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /**
   * Returns a deterministic integer in the half-open range `[0, maxExclusive)`.
   */
  nextInt(maxExclusive: number): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return Math.floor((this.state / 4294967296) * maxExclusive);
  }
}
