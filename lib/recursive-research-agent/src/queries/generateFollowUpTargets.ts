import type { CrawlTarget, ResearchGap, ResearchState } from '../types';
import { scoreTarget } from '../frontier/scoreTarget';
import { stableHash } from '../utils/hash';
import { nowIso } from '../utils/time';

export function generateFollowUpTargets(args: {
  state: ResearchState;
  gaps: ResearchGap[];
}): CrawlTarget[] {
  const { state } = args;
  const createdAt = nowIso();
  const raw = args.gaps
    .filter((gap) => gap.status === 'open')
    .sort((a, b) => b.priority - a.priority)
    .flatMap((gap) => [
      ...gap.suggestedQueries.slice(0, 2).map((query) => target({ kind: 'search_query', query, gapId: gap.id, priority: gap.priority, createdAt })),
      ...(state.metadata?.enableSemanticExpansion ? gap.suggestedQueries.slice(0, 1).map((query) => target({ kind: 'semantic_query', query, gapId: gap.id, priority: gap.priority * 0.88, createdAt })) : []),
      ...(state.metadata?.enableLocalIndexSearch ? gap.suggestedQueries.slice(0, 1).map((query) => target({ kind: 'local_index_query', query, gapId: gap.id, priority: gap.priority * 0.84, createdAt })) : []),
      ...(gap.suggestedDomains ?? []).map((domain) => target({ kind: 'domain_search', domain, query: gap.suggestedQueries[0] ?? state.task.question, gapId: gap.id, priority: gap.priority * 0.92, createdAt })),
      ...(gap.suggestedUrls ?? []).map((url) => target({ kind: 'url', url, gapId: gap.id, priority: gap.priority * 0.95, createdAt })),
    ]);
  const seen = new Set<string>();
  return raw
    .map((item) => ({ ...item, priority: scoreTarget({ target: item, state }) }))
    .filter((item) => item.priority > 0 && !state.frontier.hasEquivalent(item))
    .filter((item) => {
      const key = 'url' in item ? `url:${item.url}` : `${item.kind}:${item.query}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, state.budget.maxFrontierSize);
}

type TargetArgs =
  | { kind: 'search_query'; query: string; gapId: string; priority: number; createdAt: string }
  | { kind: 'semantic_query'; query: string; gapId: string; priority: number; createdAt: string }
  | { kind: 'local_index_query'; query: string; gapId: string; priority: number; createdAt: string }
  | { kind: 'domain_search'; domain: string; query: string; gapId: string; priority: number; createdAt: string }
  | { kind: 'url'; url: string; gapId: string; priority: number; createdAt: string };

function target(args: TargetArgs): CrawlTarget {
  const value = 'url' in args ? args.url : `${'domain' in args ? args.domain : ''}:${args.query}`;
  return {
    id: `target-${stableHash(`${args.kind}:${value}:${args.gapId}`)}`,
    kind: args.kind,
    priority: args.priority,
    depth: 1,
    parentId: args.gapId,
    reason: `Addresses ${args.gapId}.`,
    createdAt: args.createdAt,
    ...('url' in args ? { url: args.url } : {}),
    ...('query' in args ? { query: args.query } : {}),
    ...('domain' in args ? { domain: args.domain } : {}),
  } as CrawlTarget;
}
