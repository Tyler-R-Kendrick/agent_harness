import { describe, expect, it } from 'vitest';
import { createDurableTaskMachine, transitionDurableTaskStatus } from '../index.js';

describe('durable task xstate machine', () => {
  it('models queued, running, waiting, terminal, and retry transitions', () => {
    expect(createDurableTaskMachine('queued').initialState).toBe('queued');
    expect(transitionDurableTaskStatus('queued', 'START')).toBe('running');
    expect(transitionDurableTaskStatus('running', 'WAIT')).toBe('waiting');
    expect(transitionDurableTaskStatus('waiting', 'RESUME')).toBe('queued');
    expect(transitionDurableTaskStatus('running', 'COMPLETE')).toBe('completed');
    expect(transitionDurableTaskStatus('running', 'FAIL_RETRYABLE')).toBe('queued');
    expect(transitionDurableTaskStatus('running', 'FAIL_FINAL')).toBe('failed');
    expect(transitionDurableTaskStatus('queued', 'CANCEL')).toBe('cancelled');
    expect(transitionDurableTaskStatus('completed', 'RETRY')).toBe('completed');
    expect(transitionDurableTaskStatus('failed', 'RETRY')).toBe('queued');
  });
});
