import type { ResearchBudget } from './types';

export const DEFAULT_RESEARCH_BUDGET: ResearchBudget = {
  maxIterations: 4,
  maxDepth: 2,
  maxSearchQueries: 8,
  maxFetchedPages: 12,
  maxPagesPerDomain: 3,
  maxRuntimeMs: 90_000,
  maxFrontierSize: 50,
  maxTargetsPerIteration: 3,
  targetSufficiencyScore: 0.78,
};

export const DEFAULT_SUCCESS_CRITERIA = [
  'Collect relevant evidence from multiple sources',
  'Return cited evidence',
  'Identify unresolved gaps or limitations',
];
