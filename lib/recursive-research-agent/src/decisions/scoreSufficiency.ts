import type { ResearchState, SufficiencyScore } from '../types';
import { clamp } from '../utils/clamp';
import { domainFromUrl } from '../utils/domain';

export function scoreSufficiency(state: ResearchState): SufficiencyScore {
  const relevantEvidence = state.evidence.filter((item) => item.quality.relevance >= 0.65);
  const strongEvidence = state.evidence.filter((item) => item.quality.overall >= 0.7);
  const uniqueDomains = new Set(relevantEvidence.map((item) => domainFromUrl(item.url)).filter(Boolean));
  const openHighPriorityGaps = state.gaps.filter((gap) => gap.status === 'open' && gap.priority >= 0.6);
  const relevanceCoverage = clamp(relevantEvidence.length / 6);
  const sourceDiversity = clamp(uniqueDomains.size / 4);
  const freshnessCoverage = needsFreshness(state) ? (state.evidence.some((item) => item.quality.freshness >= 0.7) ? 1 : 0.35) : 1;
  const contradictionResolution = clamp(1 - (state.claims.filter((claim) => claim.status !== 'supported').length * 0.25));
  const addressedCriteria = state.task.successCriteria.filter((criterion) => strongEvidence.some((item) => item.text.toLowerCase().includes(criterion.toLowerCase()))).length;
  const taskCompleteness = clamp((addressedCriteria / Math.max(1, state.task.successCriteria.length)) - (openHighPriorityGaps.length * 0.12));
  const overall = clamp((0.35 * relevanceCoverage) + (0.20 * sourceDiversity) + (0.15 * freshnessCoverage) + (0.10 * contradictionResolution) + (0.20 * taskCompleteness));
  return { relevanceCoverage, sourceDiversity, freshnessCoverage, contradictionResolution, taskCompleteness, overall };
}

function needsFreshness(state: ResearchState): boolean {
  return state.task.scope?.freshness !== undefined && state.task.scope.freshness !== 'any'
    || /\b(?:latest|current|recent|today|this week)\b/i.test(state.task.question);
}
