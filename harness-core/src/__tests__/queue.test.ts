import { describe, expect, it } from 'vitest';
import { PendingMessageQueue } from '../queue.js';

describe('PendingMessageQueue', () => {
  it('drains all queued messages in all mode', () => {
    const queue = new PendingMessageQueue<string>('all');
    queue.enqueue('first');
    queue.enqueue('second');

    expect(queue.size).toBe(2);
    expect(queue.hasItems()).toBe(true);
    expect(queue.drain()).toEqual(['first', 'second']);
    expect(queue.hasItems()).toBe(false);
  });

  it('drains one message at a time in one-at-a-time mode', () => {
    const queue = new PendingMessageQueue<string>('one-at-a-time');
    queue.enqueue('first');
    queue.enqueue('second');

    expect(queue.drain()).toEqual(['first']);
    expect(queue.drain()).toEqual(['second']);
    expect(queue.drain()).toEqual([]);
  });

  it('clears queued messages', () => {
    const queue = new PendingMessageQueue<string>('all');
    queue.enqueue('discard');

    queue.clear();

    expect(queue.size).toBe(0);
    expect(queue.drain()).toEqual([]);
  });
});
