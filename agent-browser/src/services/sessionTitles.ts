import type { ChatMessage } from '../types';

const LOW_INFORMATION_TEXT = new Set([
  'help',
  'hi',
  'hello',
  'ok',
  'okay',
  'thanks',
  'thank you',
]);

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'because',
  'break',
  'breaks',
  'breaking',
  'broken',
  'can',
  'could',
  'created',
  'for',
  'from',
  'into',
  'me',
  'please',
  'summarize',
  'summary',
  'the',
  'this',
  'to',
  'why',
  'with',
  'workspace',
  'you',
]);

const ACTION_TOKENS = new Set([
  'build',
  'create',
  'debug',
  'design',
  'fix',
  'implement',
  'investigate',
  'plan',
  'review',
  'update',
]);

export function deriveSessionTitle(messages: readonly ChatMessage[]): string | null {
  const candidates = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role,
      text: compactText(message.streamedContent || message.content),
    }))
    .filter((message) => Boolean(message.text));

  const userCandidate = candidates.find((message) => message.role === 'user' && isUsefulTitleSeed(message.text));
  const fallbackCandidate = [...candidates]
    .reverse()
    .find((message) => message.role === 'assistant' && isUsefulTitleSeed(message.text));
  const seed = userCandidate ?? fallbackCandidate ?? null;
  if (!seed) return null;

  const tokens = extractTitleTokens(seed.text);
  if (!tokens.length) return null;
  const maxWords = seed.role === 'user' && ACTION_TOKENS.has(tokens[0]?.toLowerCase() ?? '') ? 3 : 4;
  return tokens.slice(0, maxWords).map(titleCaseToken).join(' ');
}

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function isUsefulTitleSeed(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[^\p{L}\p{N}\s-]+/gu, '').trim();
  if (!normalized || LOW_INFORMATION_TEXT.has(normalized)) return false;
  return extractTitleTokens(value).length >= 2;
}

function extractTitleTokens(value: string): string[] {
  const stripped = value
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[`*_#>[{}\[\]()"':;,.!?/\\|]+/g, ' ');
  const rawTokens = stripped.match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? [];
  return unique(
    rawTokens
      .map((token) => token.replace(/^-+|-+$/g, ''))
      .filter((token) => token.length > 1)
      .filter((token) => !STOPWORDS.has(token.toLowerCase())),
  );
}

function titleCaseToken(value: string): string {
  if (/^[A-Z0-9]{2,}$/.test(value)) return value;
  const lower = value.toLowerCase();
  return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`;
}

function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}
