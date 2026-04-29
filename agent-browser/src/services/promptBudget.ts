import type { ModelMessage } from '@ai-sdk/provider-utils';
import type { ModelCapabilities } from './agentProvider';

const CHARS_PER_TOKEN = 4;
const DEFAULT_RESERVED_TOKENS = 64;

export type PromptBudget = {
  contextWindow: number;
  maxOutputTokens: number;
  reservedTokens: number;
  maxInputTokens: number;
};

export type BudgetedMessage = {
  role: string;
  content: string;
};

export type FittedMessagesResult = {
  messages: BudgetedMessage[];
  droppedMessages: number;
  usedTokens: number;
};

function clampTokens(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

export function createPromptBudget(
  capabilities: Pick<ModelCapabilities, 'contextWindow' | 'maxOutputTokens'>,
  reservedTokens = DEFAULT_RESERVED_TOKENS,
): PromptBudget {
  const contextWindow = clampTokens(capabilities.contextWindow);
  const maxOutputTokens = clampTokens(capabilities.maxOutputTokens);
  const reserved = clampTokens(reservedTokens);

  return {
    contextWindow,
    maxOutputTokens,
    reservedTokens: reserved,
    maxInputTokens: Math.max(1, contextWindow - maxOutputTokens - reserved),
  };
}

export function fitTextToTokenBudget(text: string, maxTokens: number): string {
  const tokenLimit = clampTokens(maxTokens);
  if (!text) return '';
  if (tokenLimit <= 0) return '';
  if (estimateTokenCount(text) <= tokenLimit) return text;

  const maxChars = tokenLimit * CHARS_PER_TOKEN;
  const tail = Math.floor((maxChars - 3) / 2);
  const head = maxChars - tail - 3;
  return `${text.slice(0, head)}...${tail > 0 ? text.slice(-tail) : ''}`;
}

export function normalizeModelMessage(message: ModelMessage): BudgetedMessage {
  if (typeof message.content === 'string') {
    return { role: message.role, content: message.content };
  }

  const parts = message.content
    .map((part) => {
      if (part.type === 'text') {
        return part.text;
      }
      if (part.type === 'tool-result') {
        return `[tool_result:${part.toolName}]`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');

  return { role: message.role, content: parts };
}

export function fitMessagesToBudget(messages: BudgetedMessage[], budget: PromptBudget): FittedMessagesResult {
  if (!messages.length) {
    return { messages: [], droppedMessages: 0, usedTokens: 0 };
  }

  let remaining = budget.maxInputTokens;
  const kept: BudgetedMessage[] = [];
  let droppedMessages = 0;

  const systemMessage = messages.find((message) => message.role === 'system');
  if (systemMessage) {
    const allocated = Math.max(32, Math.floor(budget.maxInputTokens * 0.35));
    const fittedContent = fitTextToTokenBudget(systemMessage.content, Math.min(allocated, remaining));
    kept.push({ role: systemMessage.role, content: fittedContent });
    remaining = Math.max(0, remaining - estimateTokenCount(fittedContent));
  }

  const nonSystemMessages = messages.filter((message) => message !== systemMessage);
  const reversed: BudgetedMessage[] = [];
  for (let index = nonSystemMessages.length - 1; index >= 0; index -= 1) {
    const message = nonSystemMessages[index];
    const messageTokens = estimateTokenCount(message.content);
    if (messageTokens <= remaining) {
      reversed.push(message);
      remaining -= messageTokens;
      continue;
    }

    const fittedContent = fitTextToTokenBudget(message.content, remaining);
    if (fittedContent) {
      reversed.push({ role: message.role, content: fittedContent });
      remaining = 0;
      droppedMessages += index;
    } else {
      droppedMessages += index + 1;
    }
    break;
  }

  kept.push(...reversed.reverse());
  const usedTokens = kept.reduce((sum, message) => sum + estimateTokenCount(message.content), 0);
  return { messages: kept, droppedMessages, usedTokens };
}
