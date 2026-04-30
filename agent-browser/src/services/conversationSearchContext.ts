import type { ModelMessage } from '@ai-sdk/provider-utils';
import type { SearchTurnContext } from '../types';

export const SEARCH_TURN_CONTEXT_MARKER = 'Agent Browser search turn context:';

export interface ConversationSearchResolution {
  messages: ModelMessage[];
  resolvedTaskText: string;
  needsClarification: boolean;
  clarificationPrompt?: string;
  context?: SearchTurnContext;
  requestedCount?: number;
  excludedCandidateNames: string[];
  inheritedLocation?: string;
  inheritedSubject?: string;
  resolvedSubject?: string;
}

export function createSearchTurnContextSystemMessage(context: SearchTurnContext): ModelMessage {
  return {
    role: 'system',
    content: `${SEARCH_TURN_CONTEXT_MARKER}\n${JSON.stringify(context)}`,
  };
}

export function resolveConversationSearchContext(messages: ModelMessage[]): ConversationSearchResolution {
  const latest = messages.at(-1);
  const latestText = latest ? searchTaskTextFromMessage(messageContentToText(latest.content).trim()) : '';
  const priorContext = findPriorSearchContext(messages.slice(0, -1));
  const requestedCount = extractRequestedCount(latestText);
  const continuation = isContinuationRequest(latestText);
  const explicitSubject = extractExplicitSubject(latestText, continuation);
  const explicitRanking = inferRankingPhrase(latestText);
  const openNow = /\bopen\s+now\b/i.test(latestText);
  const explicitExclusions = extractExplicitExclusions(latestText);

  if (continuation && !priorContext && !explicitSubject) {
    return {
      messages,
      resolvedTaskText: latestText,
      needsClarification: true,
      clarificationPrompt: 'What should I show more of?',
      requestedCount,
      excludedCandidateNames: explicitExclusions,
    };
  }

  if (!priorContext || (!continuation && !explicitSubject)) {
    return {
      messages,
      resolvedTaskText: latestText,
      needsClarification: false,
      requestedCount,
      excludedCandidateNames: explicitExclusions,
    };
  }

  const inheritedLocation = priorContext.location ? normalizeLocationForPrompt(priorContext.location) : undefined;
  const subject = explicitSubject ?? priorContext.subject;
  const ranking = openNow ? 'open now' : explicitRanking ?? (continuation ? rankingGoalToPhrase(priorContext.rankingGoal) : undefined);
  const resolvedTaskText = buildResolvedTaskText({
    ranking,
    subject,
    location: inheritedLocation,
  });
  const excludedCandidateNames = uniqueStrings([
    ...priorContext.acceptedCandidates.map((candidate) => candidate.name),
    ...explicitExclusions,
  ]);

  return {
    messages: replaceLatestUserMessage(messages, resolvedTaskText),
    resolvedTaskText,
    needsClarification: false,
    context: priorContext,
    requestedCount,
    excludedCandidateNames,
    inheritedLocation,
    inheritedSubject: priorContext.subject,
    resolvedSubject: subject,
  };
}

function searchTaskTextFromMessage(text: string): string {
  const enhanced = text.match(/^Enhanced task prompt:\s*(.+)$/im)?.[1];
  if (enhanced?.trim()) return enhanced.trim();
  const original = text.match(/^Original request:\s*(.+)$/im)?.[1];
  if (original?.trim()) return original.trim();
  return text;
}

function findPriorSearchContext(messages: ModelMessage[]): SearchTurnContext | undefined {
  for (const message of [...messages].reverse()) {
    const text = messageContentToText(message.content);
    if (message.role === 'system' && text.includes(SEARCH_TURN_CONTEXT_MARKER)) {
      const parsed = parseSearchTurnContext(text);
      if (parsed) return parsed;
    }
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'assistant') continue;
    const parsed = parseSearchContextFromAssistantText(messageContentToText(message.content));
    if (parsed) {
      const priorUserText = findPreviousUserText(messages, index);
      return {
        ...parsed,
        taskText: priorUserText ?? parsed.taskText,
        rankingGoal: parsed.rankingGoal ?? inferRankingGoalValue(priorUserText ?? ''),
      };
    }
  }
  return undefined;
}

function parseSearchTurnContext(text: string): SearchTurnContext | undefined {
  const index = text.indexOf(SEARCH_TURN_CONTEXT_MARKER);
  if (index < 0) return undefined;
  const payload = text.slice(index + SEARCH_TURN_CONTEXT_MARKER.length).trim();
  try {
    const parsed = JSON.parse(payload) as Partial<SearchTurnContext>;
    if (!parsed.subject || !parsed.answerSubject || !Array.isArray(parsed.acceptedCandidates)) return undefined;
    return {
      taskText: parsed.taskText ?? parsed.resolvedTaskText ?? '',
      resolvedTaskText: parsed.resolvedTaskText ?? parsed.taskText ?? '',
      subject: parsed.subject,
      answerSubject: parsed.answerSubject,
      rankingGoal: parsed.rankingGoal,
      location: parsed.location,
      acceptedCandidates: parsed.acceptedCandidates
        .map((candidate) => ({
          name: typeof candidate?.name === 'string' ? candidate.name.trim() : '',
          url: typeof candidate?.url === 'string' ? candidate.url.trim() : undefined,
        }))
        .filter((candidate) => candidate.name),
      rejectedLabels: Array.isArray(parsed.rejectedLabels) ? parsed.rejectedLabels.filter(isNonEmptyString) : [],
      sourceQueries: Array.isArray(parsed.sourceQueries) ? parsed.sourceQueries.filter(isNonEmptyString) : [],
      requestedCount: parsed.requestedCount,
      validationContract: isValidationContract(parsed.validationContract) ? parsed.validationContract : undefined,
      timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now(),
    };
  } catch {
    return undefined;
  }
}

function isValidationContract(value: unknown): NonNullable<SearchTurnContext['validationContract']> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Partial<NonNullable<SearchTurnContext['validationContract']>>;
  return record.type === 'validation-contract' && Array.isArray(record.constraints)
    ? record as NonNullable<SearchTurnContext['validationContract']>
    : undefined;
}

function parseSearchContextFromAssistantText(text: string): SearchTurnContext | undefined {
  const heading = text.match(/\bHere are\s+(.+?)\s+near\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,5},?\s+[A-Z]{2})\s*:/i);
  if (!heading) return undefined;
  const acceptedCandidates = [...text.matchAll(/^\s*\d+\.\s+\[([^\]]+)\]\(([^)]+)\)/gim)]
    .map((match) => ({ name: match[1].trim(), url: match[2].trim() }))
    .filter((candidate) => candidate.name && candidate.url);
  if (acceptedCandidates.length === 0) return undefined;
  const answerSubject = heading[1].trim();
  const location = heading[2].trim();
  return {
    taskText: `${answerSubject} near ${location}`,
    resolvedTaskText: `${answerSubject} near ${normalizeLocationForPrompt(location)}`,
    subject: answerSubject,
    answerSubject,
    location,
    acceptedCandidates,
    rejectedLabels: [],
    sourceQueries: [],
    timestamp: Date.now(),
  };
}

function isContinuationRequest(text: string): boolean {
  return /\b(show|give|find|list|suggest|recommend)\s+(?:me\s+)?(?:\d+\s+)?more\b/i.test(text)
    || /\b(any\s+others?|what\s+else|more\s+like\s+#?\d+|closer\s+ones?|not\s+those|not\s+that)\b/i.test(text)
    || /^\s*not\s+[^,.;]+,\s*(?:show|give|find|list|suggest|recommend)\b/i.test(text);
}

function extractRequestedCount(text: string): number | undefined {
  const numeric = text.match(/\b(\d{1,2})\s+(?:more|others?|additional|extra)\b/i)?.[1]
    ?? text.match(/\b(?:show|give|find|list|suggest|recommend)\s+(?:me\s+)?(\d{1,2})\b/i)?.[1];
  if (numeric) {
    const count = Number.parseInt(numeric, 10);
    if (Number.isFinite(count) && count > 0) return Math.min(count, 10);
  }
  if (/\bmore\b/i.test(text)) return 3;
  return undefined;
}

function extractExplicitSubject(text: string, continuation: boolean): string | undefined {
  if (/^\s*not\b/i.test(text)) return undefined;
  const normalized = text
    .replace(/\bmore\s+like\s+#?\d+\b/ig, ' ')
    .replace(/\blike\s+#?\d+\b/ig, ' ')
    .replace(/\blike\s+(?:the\s+)?(?:first|second|third|last|previous|prior)\b/ig, ' ')
    .replace(/\b(?:closer|nearer)\s+ones?\b/ig, ' ')
    .replace(/\b(?:near|in|around)\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,5},?\s+[A-Z]{2}\b/g, ' ')
    .replace(/[?!.#]/g, ' ')
    .replace(/\b(?:what\s+about|how\s+about|what're|what are|show me|show|give me|give|find|list|recommend|recommended|suggest|more|others?|other|any|near me|nearby|around me|closest|nearest|closer|nearer|best|top|worst|most popular|popular|highest rated|highly rated|family-friendly|family friendly|budget-friendly|budget friendly|quiet|open now|open|now|please|like|\d+)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return undefined;
  if (/^(?:ones?|those|that|this|it|results?|options?|places?)$/i.test(normalized)) return undefined;
  if (continuation && normalized.split(/\s+/).length === 1 && /^(?:open|closer|nearer)$/i.test(normalized)) return undefined;
  return normalized;
}

function extractExplicitExclusions(text: string): string[] {
  const exclusions: string[] = [];
  const notMatch = text.match(/\bnot\s+([^,.;]+?)(?:\s+(?:show|give|find|list|suggest|recommend)\b|,|;|\.|$)/i);
  if (notMatch?.[1]) {
    const cleaned = notMatch[1]
      .replace(/\b(?:please|more|again|those|that|this|ones?)\b/ig, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned) exclusions.push(cleaned);
  }
  return uniqueStrings(exclusions);
}

function inferRankingPhrase(text: string): string | undefined {
  if (/\b(worst|lowest\s+rated)\b/i.test(text)) return 'worst';
  if (/\b(closest|nearest|closer)\b/i.test(text)) return 'closest';
  if (/\b(most\s+popular|popular)\b/i.test(text)) return 'most popular';
  if (/\b(open\s+now)\b/i.test(text)) return 'open now';
  if (/\b(highest\s+rated|highly\s+rated)\b/i.test(text)) return 'highest rated';
  if (/\b(family-friendly|family friendly)\b/i.test(text)) return 'family-friendly';
  if (/\b(budget-friendly|budget friendly|cheap|affordable)\b/i.test(text)) return 'budget-friendly';
  if (/\b(quiet)\b/i.test(text)) return 'quiet';
  if (/\b(best|top|highly\s+rated)\b/i.test(text)) return 'best';
  if (/\b(recommend|recommended|suggest)\b/i.test(text)) return 'recommended';
  if (/\b(near\s+me|nearby|around\s+me)\b/i.test(text)) return 'nearby';
  return undefined;
}

function inferRankingGoalValue(text: string): SearchTurnContext['rankingGoal'] {
  if (/\b(worst|lowest\s+rated)\b/i.test(text)) return 'worst';
  if (/\b(closest|nearest|closer)\b/i.test(text)) return 'closest';
  if (/\b(most\s+popular|popular)\b/i.test(text)) return 'most-popular';
  if (/\b(open\s+now)\b/i.test(text)) return 'open-now';
  if (/\b(highest\s+rated|highly\s+rated)\b/i.test(text)) return 'highly-rated';
  if (/\b(family-friendly|family friendly)\b/i.test(text)) return 'family-friendly';
  if (/\b(budget-friendly|budget friendly|cheap|affordable)\b/i.test(text)) return 'budget-friendly';
  if (/\b(quiet)\b/i.test(text)) return 'quiet';
  if (/\b(best|top|highly\s+rated)\b/i.test(text)) return 'best';
  if (/\b(current|latest|today|open\s+now)\b/i.test(text)) return 'current';
  if (/\b(recommend|suggest)\b/i.test(text)) return 'recommended';
  if (/\b(near\s+me|nearby|around\s+me)\b/i.test(text)) return 'nearby';
  return undefined;
}

function rankingGoalToPhrase(goal: SearchTurnContext['rankingGoal']): string | undefined {
  switch (goal) {
    case 'best':
      return 'best';
    case 'worst':
      return 'worst';
    case 'closest':
      return 'closest';
    case 'most-popular':
      return 'most popular';
    case 'recommended':
      return 'recommended';
    case 'current':
      return 'current';
    case 'open-now':
      return 'open now';
    case 'highly-rated':
      return 'highest rated';
    case 'family-friendly':
      return 'family-friendly';
    case 'budget-friendly':
      return 'budget-friendly';
    case 'quiet':
      return 'quiet';
    case 'nearby':
      return 'nearby';
    default:
      return undefined;
  }
}

function buildResolvedTaskText({
  ranking,
  subject,
  location,
}: {
  ranking?: string;
  subject: string;
  location?: string;
}): string {
  return [ranking, subject, location ? 'near' : '', location]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLocationForPrompt(location: string): string {
  return location.replace(/,/g, '').replace(/\s+/g, ' ').trim();
}

function replaceLatestUserMessage(messages: ModelMessage[], content: string): ModelMessage[] {
  if (messages.length === 0) return messages;
  return messages.map((message, index) => (
    index === messages.length - 1 && message.role === 'user'
      ? { ...message, content }
      : message
  ));
}

function findPreviousUserText(messages: ModelMessage[], beforeIndex: number): string | undefined {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'user') return messageContentToText(message.content).trim();
  }
  return undefined;
}

function messageContentToText(content: ModelMessage['content']): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return JSON.stringify(content);
  return content
    .map((part) => (part.type === 'text' ? part.text : `[${part.type}]`))
    .join('\n');
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const normalized = value.replace(/\s+/g, ' ').trim();
    const key = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }
  return unique;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
