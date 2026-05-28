import type {
  DirectSourceSearchIntent,
  SourceResultAnswerInput,
  SourceSearchResult,
  UnavailableSearchInput,
} from './types';

const DIRECT_SOURCE_QUERY_PATTERN = /\b(?:who|what|when|where|why|how|current|latest|today|docs?|documentation|guide|reference|api|update|news|announcement|report|article|overview|status|changelog|release|website|url|official)\b/i;
const DIRECT_SOURCE_RANKING_GOALS = new Set(['current', 'recommended']);
const ENTITY_LIST_CONSTRAINT_TYPES = new Set([
  'count',
  'location',
  'name_prefix',
  'name_suffix',
  'rhyme',
  'exclusion',
]);

export function isDirectSourceSearchIntent(intent: DirectSourceSearchIntent): boolean {
  if (!intent.externalSearchRequired) return false;
  if (intent.locationRequired) return false;
  if ((intent.requestedCount ?? 0) > 0) return false;
  if (intent.rankingGoal !== undefined && !DIRECT_SOURCE_RANKING_GOALS.has(intent.rankingGoal)) return false;
  if ((intent.validationConstraints ?? []).some((constraint) => ENTITY_LIST_CONSTRAINT_TYPES.has(constraint.type))) {
    return false;
  }
  return DIRECT_SOURCE_QUERY_PATTERN.test(intent.currentTaskText);
}

export function canAnswerFromSourceResults({
  intent,
  searchResult,
}: {
  intent: DirectSourceSearchIntent;
  searchResult: SourceSearchResult;
}): boolean {
  if (!isDirectSourceSearchIntent(intent)) return false;
  if (searchResult.status !== 'found') return false;
  return searchResult.results.length > 0;
}

export function composeSourceResultAnswer({
  subject,
  results,
  limit = 3,
  maxSnippetLength = 220,
}: SourceResultAnswerInput): string {
  if (results.length === 0) return `I could not find search results for ${subject}.`;
  const visibleResults = results.slice(0, Math.max(1, limit));
  return [
    `Here are web results for ${subject}:`,
    '',
    ...visibleResults.map((item, index) => formatSourceResultLine(item, index, maxSnippetLength)),
  ].join('\n');
}

export function formatUnavailableSearchMessage({
  answerSubject,
  location,
  reason,
}: UnavailableSearchInput): string {
  const target = location ? `${answerSubject} near ${location}` : answerSubject;
  return [
    `Web search is unavailable for ${target}.`,
    reason ? `Search issue: ${reason}` : '',
  ].filter(Boolean).join('\n');
}

function formatSourceResultLine(
  item: { title: string; url: string; snippet: string },
  index: number,
  maxSnippetLength: number,
): string {
  const snippet = truncateAnswerSnippet(item.snippet, maxSnippetLength);
  return snippet
    ? `${index + 1}. [${item.title}](${item.url}) - ${snippet}`
    : `${index + 1}. [${item.title}](${item.url})`;
}

function truncateAnswerSnippet(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}
