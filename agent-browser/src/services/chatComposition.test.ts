import { describe, expect, it } from 'vitest';
import { appendPendingLocalTurn } from './chatComposition';

describe('appendPendingLocalTurn', () => {
  it('preserves prior messages when appending a new local turn', () => {
    const existing = [
      { id: 'system-1', role: 'system', content: 'ready' },
      { id: 'user-1', role: 'user', content: 'first' },
    ] as const;

    const appended = appendPendingLocalTurn([...existing], 'second', {
      userId: 'user-2',
      assistantId: 'assistant-2',
    });

    expect(appended).toEqual([
      ...existing,
      { id: 'user-2', role: 'user', content: 'second' },
      { id: 'assistant-2', role: 'assistant', content: '', status: 'thinking' },
    ]);
  });
});
