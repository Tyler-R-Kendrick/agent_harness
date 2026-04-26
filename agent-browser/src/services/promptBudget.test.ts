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

  it('returns no text when content or token budget is empty', () => {
    expect(fitTextToTokenBudget('', 4)).toBe('');
    expect(fitTextToTokenBudget('content', 0)).toBe('');
  });

  it('keeps very small text budgets within the token limit', () => {
    const fitted = fitTextToTokenBudget('0123456789abcdefghijklmnopqrstuvwxyz', 1);

    expect(estimateTokenCount(fitted)).toBeLessThanOrEqual(1);
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

  it('omits unsupported model message parts when normalizing arrays', () => {
    const normalized = normalizeModelMessage({
      role: 'user',
      content: [
        { type: 'text', text: 'visible' },
        { type: 'file', data: 'ignored', mimeType: 'text/plain' },
      ],
    } as never);

    expect(normalized).toEqual({
      role: 'user',
      content: 'visible',
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

  it('fits recent messages when there is no system message', () => {
    const budget = createPromptBudget({ contextWindow: 16, maxOutputTokens: 4 }, 4);
    const result = fitMessagesToBudget([
      { role: 'user', content: 'old:' + 'a'.repeat(80) },
      { role: 'assistant', content: 'latest' },
    ], budget);

    expect(result.messages[0]).toEqual({ role: 'user', content: expect.stringContaining('...') });
    expect(result.messages.at(-1)).toEqual({ role: 'assistant', content: 'latest' });
    expect(result.droppedMessages).toBe(0);
    expect(result.usedTokens).toBeLessThanOrEqual(budget.maxInputTokens);
  });

  it('does not exceed the input budget when only a tiny message fragment fits', () => {
    const budget = createPromptBudget({ contextWindow: 3, maxOutputTokens: 1 }, 1);
    const result = fitMessagesToBudget([
      { role: 'system', content: 'System:' + 's'.repeat(120) },
      { role: 'user', content: 'latest:' + 'c'.repeat(120) },
    ], budget);

    expect(budget.maxInputTokens).toBe(1);
    expect(result.usedTokens).toBeLessThanOrEqual(budget.maxInputTokens);
    expect(result.droppedMessages).toBe(1);
  });
});
