import type { CrawlTarget, RecursiveResearchRequest, ResearchTask } from '../types';
import { stableHash } from '../utils/hash';
import { nowIso } from '../utils/time';

export function generateInitialTargets(args: {
  request: RecursiveResearchRequest;
  task: ResearchTask;
}): CrawlTarget[] {
  const { request, task } = args;
  const targets: CrawlTarget[] = [];
  const addQuery = (query: string, priority: number, reason: string): void => {
    const normalized = query.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!normalized || targets.some((target) => 'query' in target && target.query.toLowerCase() === normalized)) return;
    targets.push(base({ kind: 'search_query', query, priority, reason }));
  };
  for (const query of request.initialQueries ?? []) addQuery(query, 0.9, 'Caller-provided initial query.');
  addQuery(task.question, 1, 'Original research question.');
  addQuery(keywordDenseQuery(task.question), 0.75, 'Keyword-dense query generated from the question.');
  if (/\b(?:latest|current|recent|today|this week)\b/i.test(task.question)) addQuery(`${task.question} ${new Date().getFullYear()}`, 0.72, 'Freshness-sensitive current-year query.');
  for (const url of request.initialUrls ?? []) targets.push(base({ kind: 'url', url, priority: 0.86, reason: 'Caller-provided initial URL.' }));
  return targets;
}

function base<T extends Omit<CrawlTarget, 'id' | 'depth' | 'createdAt'>>(target: T): T & Pick<CrawlTarget, 'id' | 'depth' | 'createdAt'> {
  const key = 'url' in target ? target.url : target.query;
  return { id: `target-${stableHash(`${target.kind}:${key}`)}`, depth: 0, createdAt: nowIso(), ...target };
}

function keywordDenseQuery(question: string): string {
  return question
    .replace(/\b(?:what|are|the|a|an|to|for|of|and|or|in|on|with|building|build|best|approaches)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
