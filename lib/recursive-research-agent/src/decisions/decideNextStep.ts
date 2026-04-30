import type { CrawlDecision, ResearchState } from '../types';
import { generateFollowUpTargets } from '../queries/generateFollowUpTargets';
import { stableHash } from '../utils/hash';
import { nowIso } from '../utils/time';
import { scoreSufficiency } from './scoreSufficiency';
import { shouldStop } from './shouldStop';

export function decideNextStep(state: ResearchState): CrawlDecision {
  const sufficiency = scoreSufficiency(state);
  const highPriorityGaps = state.gaps.filter((gap) => gap.status === 'open' && gap.priority >= 0.6);
  if (Number(state.metadata?.redundantIterations ?? 0) >= 2 && (state.metadata?.enableSemanticExpansion || state.metadata?.enableLocalIndexSearch)) {
    return {
      action: 'change_strategy',
      reason: 'Current strategy is redundant; trying alternate semantic or local-index targets.',
      confidence: 0.72,
      sufficiency,
      nextTargets: alternateTargets(state),
    };
  }
  const stop = shouldStop(state);
  if (stop.stop && !canSeedFromGaps(stop.reason, highPriorityGaps.length)) {
    return { action: 'stop', reason: stop.reason as string, confidence: sufficiency.overall, sufficiency };
  }
  if (highPriorityGaps.length > 0) {
    return {
      action: 'search_deeper',
      reason: `Open high-priority gaps remain: ${highPriorityGaps.map((gap) => gap.description).join('; ')}`,
      confidence: 0.78,
      sufficiency,
      nextTargets: generateFollowUpTargets({ state, gaps: highPriorityGaps }),
    };
  }
  const urls = state.frontier.list().filter((target) => target.kind === 'url' && target.priority >= 0.55);
  if (urls.length > 0) return { action: 'fetch_more_from_existing_results', reason: 'High-priority URLs remain from existing results.', confidence: 0.65, sufficiency, nextTargets: urls };
  return { action: 'stop', reason: 'No useful deeper research target remains.', confidence: sufficiency.overall, sufficiency };
}

export function logDecision(state: ResearchState, decision: CrawlDecision) {
  return {
    id: `decision-${stableHash(`${state.id}:${state.counters.iterations}:${decision.action}`)}`,
    iteration: state.counters.iterations,
    createdAt: nowIso(),
    ...decision,
  };
}

function alternateTargets(state: ResearchState) {
  const createdAt = nowIso();
  const base = `${state.task.question} ${state.task.successCriteria.join(' ')}`;
  return [
    state.metadata?.enableLocalIndexSearch ? { id: `target-${stableHash(`local:${base}`)}`, kind: 'local_index_query' as const, query: base, priority: 0.72, depth: 1, reason: 'Change strategy to local index search.', createdAt } : null,
    state.metadata?.enableSemanticExpansion ? { id: `target-${stableHash(`entity:${base}`)}`, kind: 'entity_expand' as const, entity: state.task.question, priority: 0.68, depth: 1, reason: 'Change strategy to entity expansion.', createdAt } : null,
  ].filter((target): target is NonNullable<typeof target> => Boolean(target));
}

function canSeedFromGaps(reason: string | undefined, highPriorityGapCount: number): boolean {
  return highPriorityGapCount > 0 && (reason?.includes('frontier') === true || reason?.includes('No high-priority') === true);
}
