import type { ResearchState, ResearchTask } from '../types';
import { clamp } from '../utils/clamp';
import { isLikelyAuthorityUrl, isSameDomain } from '../utils/domain';
import { normalizeUrl } from '../utils/normalizeUrl';

export type CandidateLink = {
  url: string;
  normalizedUrl: string;
  anchorText?: string;
  surroundingText?: string;
  sourcePageUrl: string;
  score: number;
  reason: string;
};

export function scoreCandidateLink(args: {
  link: CandidateLink;
  task: ResearchTask;
  state: ResearchState;
}): CandidateLink {
  const normalizedUrl = normalizeUrl(args.link.url);
  if (args.state.visited.some((resource) => resource.normalizedUrl === normalizedUrl)) {
    return { ...args.link, normalizedUrl, score: 0, reason: 'Already visited.' };
  }
  if (!domainAllowed(args.link.url, args.task)) {
    return { ...args.link, normalizedUrl, score: 0, reason: 'Out-of-scope or excluded domain.' };
  }
  if (isBadPath(args.link.url, args.link.anchorText)) {
    return { ...args.link, normalizedUrl, score: 0, reason: 'Navigation, login, sharing, archive, or search-result URL.' };
  }
  const authority = isLikelyAuthorityUrl(args.link.url) ? 0.35 : 0;
  const taskMatch = textMatch(`${args.link.anchorText ?? ''} ${args.link.surroundingText ?? ''}`, args.task) ? 0.25 : 0.1;
  const costOrLimit = /\b(?:free|pricing|limits?|faq|docs?|limitations?)\b/i.test(`${args.link.url} ${args.link.anchorText ?? ''}`) ? 0.15 : 0;
  const score = clamp(0.25 + authority + taskMatch + costOrLimit);
  return { ...args.link, normalizedUrl, score, reason: score >= 0.55 ? 'High-value authority or task-matched link.' : 'Low task match.' };
}

function domainAllowed(url: string, task: ResearchTask): boolean {
  const excluded = task.scope?.excludedDomains ?? [];
  if (excluded.some((domain) => isSameDomain(url, domain))) return false;
  return !task.scope?.domains?.length || task.scope.domains.some((domain) => isSameDomain(url, domain));
}

function isBadPath(url: string, anchorText = ''): boolean {
  return /\b(?:login|sign(?:in|up)|share|twitter|facebook|linkedin|tag|category|archive|search|utm_|adservice)\b/i.test(`${url} ${anchorText}`);
}

function textMatch(text: string, task: ResearchTask): boolean {
  const haystack = text.toLowerCase();
  return task.successCriteria.some((criterion) => haystack.includes(criterion.toLowerCase()))
    || task.question.toLowerCase().split(/\s+/).some((word) => word.length > 4 && haystack.includes(word));
}
