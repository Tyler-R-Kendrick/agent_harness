import { describe, expect, it } from 'vitest';
import { createPromptBudget, estimateTokenCount, fitMessagesToBudget, fitTextToTokenBudget, normalizeModelMessage } from './promptBudget';

describe('promptBudget', () => {
  it('creates prompt budgets from model capabilities', () => {
    expect(createPromptBudget({ contextWindow: 2048, maxOutputTokens: 256 })).toEqual({
      contextWindow: 2048,
      maxOutputTokens: 256,
      reservedTokens: 64,
      maxInputTokens: 1728,
    });
  });

  it('estimates token counts from character length', () => {
    expect(estimateTokenCount('abcd')).toBe(1);
    expect(estimateTokenCount('abcdefgh')).toBe(2);
  });

  it('truncates long text to fit a token budget', () => {
    const fitted = fitTextToTokenBudget('0123456789abcdefghijklmnopqrstuvwxyz', 4);
    expect(fitted).toContain('...');
    expect(estimateTokenCount(fitted)).toBeLessThanOrEqual(4);
  });

  it('normalizes model messages with text arrays and tool results', () => {
    const normalized = normalizeModelMessage({
      role: 'assistant',
      content: [
        { type: 'text', text: 'hello' },
        { type: 'tool-result', toolName: 'cli', output: { type: 'text', value: 'done' } },
      ],
    } as never);

    expect(normalized).toEqual({
      role: 'assistant',
      content: 'hello\n[tool_result:cli]',
    });
  });

  it('handles empty message lists and string-backed model messages', () => {
    const budget = createPromptBudget({ contextWindow: 128, maxOutputTokens: 16 }, 8);

    expect(fitMessagesToBudget([], budget)).toEqual({ messages: [], droppedMessages: 0, usedTokens: 0 });
    expect(normalizeModelMessage({ role: 'user', content: 'plain text' } as never)).toEqual({
      role: 'user',
      content: 'plain text',
    });
  });

  it('fits messages into the available budget while preserving recency', () => {
    const budget = createPromptBudget({ contextWindow: 120, maxOutputTokens: 16 }, 8);
    const result = fitMessagesToBudget([
      { role: 'system', content: 'System:' + 's'.repeat(120) },
      { role: 'user', content: 'old:' + 'a'.repeat(120) },
      { role: 'assistant', content: 'older:' + 'b'.repeat(120) },
      { role: 'user', content: 'latest:' + 'c'.repeat(30) },
    ], budget);

    expect(result.messages[0]?.role).toBe('system');
    expect(result.messages.at(-1)?.content).toContain('latest:');
    expect(result.usedTokens).toBeLessThanOrEqual(budget.maxInputTokens);
  });
});