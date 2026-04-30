import type { ResearchState } from '../types';
import { scoreSufficiency } from './scoreSufficiency';

export function shouldStop(state: ResearchState): {
  stop: boolean;
  reason?: string;
} {
  if (state.metadata?.aborted === true) return { stop: true, reason: 'AbortSignal was triggered.' };
  if (Date.now() >= state.deadlineAt) return { stop: true, reason: 'Maximum runtime exceeded.' };
  if (state.counters.iterations >= state.budget.maxIterations) return { stop: true, reason: 'Maximum iteration budget reached.' };
  if (state.frontier.size() === 0) return { stop: true, reason: 'Research frontier is empty.' };
  const frontier = state.frontier.list();
  if (state.counters.searchQueriesExecuted >= state.budget.maxSearchQueries && !frontier.some((target) => target.kind === 'url')) {
    return { stop: true, reason: 'Maximum search query budget reached.' };
  }
  if (state.counters.urlsFetched >= state.budget.maxFetchedPages && !frontier.some((target) => target.kind !== 'url')) {
    return { stop: true, reason: 'Maximum fetch budget reached.' };
  }
  if (state.evidence.length > 0 && scoreSufficiency(state).overall >= state.budget.targetSufficiencyScore) return { stop: true, reason: 'Target sufficiency score reached.' };
  if (!frontier.some((target) => target.priority >= 0.2)) return { stop: true, reason: 'No high-priority frontier targets remain.' };
  if (Number(state.metadata?.redundantIterations ?? 0) >= 2) return { stop: true, reason: 'Evidence has been highly redundant for two consecutive iterations.' };
  return { stop: false };
}
