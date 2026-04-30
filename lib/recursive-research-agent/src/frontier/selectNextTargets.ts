import type { CrawlTarget, ResearchState } from '../types';

export function selectNextTargets(state: ResearchState, size: number): CrawlTarget[] {
  return state.frontier.nextBatch(Math.min(size, state.budget.maxTargetsPerIteration));
}
