import type { CrawlTarget, EvidenceItem, EvidenceQuality, ExtractedPageLike, ResearchState, SemanticSearchToolResult, WebResearchToolResult } from '../types';
import { clamp } from '../utils/clamp';
import { domainFromUrl, isLikelyAuthorityUrl } from '../utils/domain';
import { stableHash } from '../utils/hash';
import { normalizeUrl } from '../utils/normalizeUrl';
import { nowIso } from '../utils/time';

export function ingestTargetResult(args: {
  state: ResearchState;
  target: CrawlTarget;
  result: WebResearchToolResult | SemanticSearchToolResult | ExtractedPageLike;
}): void {
  const { state, target, result } = args;
  const items = normalizeEvidence(state, target, result);
  for (const item of items) addEvidence(state, target, item);
  for (const citation of 'citations' in result && Array.isArray(result.citations) ? result.citations : []) {
    if (!state.citations.some((existing) => existing.url === citation.url)) state.citations.push(citation);
  }
  state.visited.push(visitedFromTarget(target, 'success'));
}

function normalizeEvidence(state: ResearchState, target: CrawlTarget, result: WebResearchToolResult | SemanticSearchToolResult | ExtractedPageLike): EvidenceItem[] {
  if ('results' in result) {
    return result.results.map((entry) => evidenceFromParts(state, target, entry.url, entry.title, entry.description ?? entry.title, 'semantic_result', entry.score));
  }
  if ('text' in result && 'url' in result && !('searchResults' in result)) {
    return [evidenceFromParts(state, target, result.finalUrl ?? result.url, result.title, result.text, 'web_page')];
  }
  const fromEvidence = (result.evidence ?? []).map((entry) => evidenceFromParts(state, target, entry.normalizedUrl ?? entry.url, entry.title, entry.text, 'web_page', entry.score, entry.citationId));
  const fromPages = (result.extractedPages ?? []).map((page) => evidenceFromParts(state, target, page.finalUrl ?? page.url, page.title, page.text, 'web_page'));
  const coveredUrls = new Set([...fromEvidence, ...fromPages].map((item) => item.normalizedUrl));
  const fromSearch = (result.searchResults ?? [])
    .filter((entry) => !coveredUrls.has(normalizeUrl(entry.normalizedUrl ?? entry.url)))
    .map((entry) => evidenceFromParts(state, target, entry.normalizedUrl ?? entry.url, entry.title, entry.snippet ?? entry.title, 'search_snippet', entry.score));
  return [...fromEvidence, ...fromPages, ...fromSearch];
}

function evidenceFromParts(
  state: ResearchState,
  target: CrawlTarget,
  url: string,
  title: string | undefined,
  text: string,
  sourceType: EvidenceItem['sourceType'],
  score?: number,
  citationId?: number,
): EvidenceItem {
  const normalizedUrl = normalizeUrl(url);
  const quality = computeQuality(state, normalizedUrl, text, score);
  const id = `evidence-${stableHash(`${normalizedUrl}:${text.slice(0, 80)}`)}`;
  const nextCitationId = citationId ?? state.citations.length + 1;
  return {
    id,
    url,
    normalizedUrl,
    ...(title ? { title } : {}),
    text,
    sourceType,
    discoveredByTargetId: target.id,
    depth: target.depth,
    extractedAt: nowIso(),
    citationId: nextCitationId,
    quality,
  };
}

function addEvidence(state: ResearchState, target: CrawlTarget, item: EvidenceItem): void {
  const key = `${item.normalizedUrl}\u0000${item.text.slice(0, 120).toLowerCase()}`;
  const exists = state.evidence.some((entry) => `${entry.normalizedUrl}\u0000${entry.text.slice(0, 120).toLowerCase()}` === key);
  if (exists) return;
  state.evidence.push(item);
  if (!state.citations.some((citation) => citation.id === item.citationId)) {
    state.citations.push({ id: item.citationId!, title: item.title, url: item.url, normalizedUrl: item.normalizedUrl, quote: item.text.slice(0, 240) });
  }
  state.graph.addNode({ id: target.id, type: 'target', value: target.reason, metadata: { kind: target.kind, depth: target.depth } });
  state.graph.addNode({ id: item.id, type: 'evidence', value: item.title ?? item.url, metadata: { url: item.url, quality: item.quality.overall } });
  state.graph.addEdge({ from: state.task.id, to: target.id, type: 'spawned' });
  state.graph.addEdge({ from: target.id, to: item.id, type: 'returned' });
}

function computeQuality(state: ResearchState, url: string, text: string, score = 0.6): EvidenceQuality {
  const terms = tokenize(`${state.task.question} ${state.task.successCriteria.join(' ')}`);
  const evidenceTerms = tokenize(text);
  const overlap = terms.filter((term) => evidenceTerms.includes(term)).length / Math.max(1, terms.length);
  const relevance = clamp(Math.max(score, overlap));
  const authority = isLikelyAuthorityUrl(url) ? 0.9 : 0.55;
  const freshness = needsFreshness(state) ? (new RegExp(String(new Date().getFullYear())).test(text) ? 1 : 0.45) : 1;
  const informationGain = state.evidence.some((entry) => entry.text.slice(0, 80).toLowerCase() === text.slice(0, 80).toLowerCase()) ? 0.2 : 0.8;
  const overall = clamp((0.45 * relevance) + (0.25 * authority) + (0.15 * freshness) + (0.15 * informationGain));
  return { relevance, authority, freshness, informationGain, overall };
}

function visitedFromTarget(target: CrawlTarget, status: 'success' | 'failed' | 'skipped') {
  const url = 'url' in target ? target.url : undefined;
  const query = 'query' in target ? target.query : 'entity' in target ? target.entity : undefined;
  return {
    id: `visited-${stableHash(`${target.id}:${status}`)}`,
    targetId: target.id,
    kind: target.kind,
    ...(url ? { url, normalizedUrl: normalizeUrl(url) } : {}),
    ...(query ? { query } : {}),
    depth: target.depth,
    status,
    visitedAt: nowIso(),
  };
}

function needsFreshness(state: ResearchState): boolean {
  return state.task.scope?.freshness !== undefined && state.task.scope.freshness !== 'any'
    || /\b(?:latest|current|recent|today|this week)\b/i.test(state.task.question);
}

function tokenize(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter((term) => term.length > 2);
}

export function domainForEvidence(evidence: EvidenceItem): string | undefined {
  return domainFromUrl(evidence.url);
}
