import type { CrawlTarget, ResearchState } from '../types';
import { clamp } from '../utils/clamp';
import { domainFromUrl, isLikelyAuthorityUrl } from '../utils/domain';
import { equivalentKey } from './FrontierQueue';

export function scoreTarget(args: {
  target: CrawlTarget;
  state: ResearchState;
}): number {
  const { target, state } = args;
  if (outOfScope(target, state)) return 0;
  const basePriority = target.priority;
  const gapPriorityBoost = state.gaps
    .filter((gap) => gap.status === 'open' && target.reason.includes(gap.id))
    .reduce((max, gap) => Math.max(max, gap.priority * 0.2), 0);
  const expectedInformationGain = expectedGain(target, state);
  const authorityHint = target.kind === 'url' && isLikelyAuthorityUrl(target.url) ? 0.15 : 0;
  const duplicatePenalty = state.frontier.hasEquivalent(target) || state.visited.some((visited) => equivalentKey(target).includes(visited.normalizedUrl ?? '∅')) ? 0.35 : 0;
  const depthPenalty = target.depth * 0.08;
  const domainSaturationPenalty = target.kind === 'url' ? domainVisits(target.url, state) * 0.08 : 0;
  return clamp(basePriority + gapPriorityBoost + expectedInformationGain + authorityHint - duplicatePenalty - depthPenalty - domainSaturationPenalty);
}

function expectedGain(target: CrawlTarget, state: ResearchState): number {
  const haystack = targetText(target).toLowerCase();
  const missingCriteria = state.task.successCriteria.filter((criterion) => !state.evidence.some((evidence) => evidence.text.toLowerCase().includes(criterion.toLowerCase())));
  return missingCriteria.some((criterion) => haystack.includes(criterion.toLowerCase())) ? 0.18 : 0.08;
}

function outOfScope(target: CrawlTarget, state: ResearchState): boolean {
  const domain = target.kind === 'url' ? domainFromUrl(target.url) : target.kind === 'domain_search' ? target.domain : undefined;
  if (!domain) return false;
  if ((state.task.scope?.excludedDomains ?? []).some((entry) => domain.endsWith(entry))) return true;
  return Boolean(state.task.scope?.domains?.length) && !state.task.scope!.domains!.some((entry) => domain.endsWith(entry));
}

function domainVisits(url: string, state: ResearchState): number {
  const domain = domainFromUrl(url);
  return domain ? state.visited.filter((visited) => visited.url && domainFromUrl(visited.url) === domain).length : 0;
}

function targetText(target: CrawlTarget): string {
  if ('query' in target) return target.query;
  if ('url' in target) return target.url;
  return target.entity;
}
