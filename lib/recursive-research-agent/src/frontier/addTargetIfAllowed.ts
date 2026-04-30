import type { CrawlTarget, ResearchState } from '../types';
import { domainFromUrl, isSameDomain } from '../utils/domain';
import { normalizeUrl } from '../utils/normalizeUrl';
import { equivalentKey } from './FrontierQueue';

export function addTargetIfAllowed(args: {
  target: CrawlTarget;
  state: ResearchState;
}): boolean {
  const { target, state } = args;
  if (target.depth > state.budget.maxDepth) return false;
  if (isVisited(target, state)) return false;
  if (state.frontier.hasEquivalent(target)) return false;
  if (!domainAllowed(target, state)) return false;
  if (target.kind === 'url' && state.counters.urlsFetched >= state.budget.maxFetchedPages) return false;
  if (isQueryTarget(target) && state.counters.searchQueriesExecuted >= state.budget.maxSearchQueries) return false;
  if (target.kind === 'url' && pageCountForDomain(target.url, state) >= state.budget.maxPagesPerDomain) return false;
  return state.frontier.add(target);
}

function isVisited(target: CrawlTarget, state: ResearchState): boolean {
  const key = equivalentKey(target);
  return state.visited.some((resource) => {
    if (resource.normalizedUrl) return key === `url:${resource.normalizedUrl}`;
    if (resource.query) return key.endsWith(resource.query.toLowerCase().replace(/\s+/g, ' ').trim());
    return false;
  });
}

function domainAllowed(target: CrawlTarget, state: ResearchState): boolean {
  const url = target.kind === 'url' ? target.url : undefined;
  const domain = target.kind === 'domain_search' ? target.domain : url ? domainFromUrl(url) : undefined;
  const excluded = state.task.scope?.excludedDomains ?? [];
  if (domain && excluded.some((entry) => isSameDomain(domain, entry))) return false;
  const allowed = state.task.scope?.domains;
  return !domain || !allowed?.length || allowed.some((entry) => isSameDomain(domain, entry));
}

function pageCountForDomain(url: string, state: ResearchState): number {
  const domain = domainFromUrl(url);
  if (!domain) return 0;
  return state.visited.filter((resource) => resource.url && domainFromUrl(resource.url) === domain).length;
}

function isQueryTarget(target: CrawlTarget): boolean {
  return ['search_query', 'domain_search', 'entity_expand', 'semantic_query', 'local_index_query'].includes(target.kind);
}

export function visitedUrl(url: string): string {
  return normalizeUrl(url);
}
