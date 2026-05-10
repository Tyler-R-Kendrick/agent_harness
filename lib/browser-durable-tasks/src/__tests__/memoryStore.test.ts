import { describe, expect, it } from 'vitest';
import { errorToRecord, cloneValue } from '../clone.js';
import { createMemoryDurableTaskStore, type DurableTaskRecord } from '../index.js';

describe('memory durable task store internals', () => {
  const baseTask: DurableTaskRecord = {
    id: 'task-a',
    type: 'alpha',
    status: 'queued',
    input: {},
    output: null,
    error: null,
    attemptCount: 0,
    maxAttempts: 1,
    createdAt: 1,
    updatedAt: 1,
    scheduledFor: 1,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    lockedUntil: null,
    lockOwner: null,
    idempotencyKey: 'idem-a',
    parentTaskId: null,
    metadata: {},
  };

  it('filters tasks and returns null for missing mutable records', async () => {
    const store = createMemoryDurableTaskStore();
    await store.putTask(baseTask);
    await store.putTask({
      ...baseTask,
      id: 'task-b',
      type: 'beta',
      status: 'waiting',
      parentTaskId: 'task-a',
      idempotencyKey: null,
      createdAt: 2,
      updatedAt: 2,
    });

    expect(await store.updateTask('missing', (task) => task)).toBeNull();
    expect(await store.updateOutboxOperation('missing', (operation) => operation)).toBeNull();
    expect(await store.listTasks({ type: 'alpha' })).toHaveLength(1);
    expect(await store.listTasks({ type: 'missing' })).toHaveLength(0);
    expect(await store.listTasks({ parentTaskId: 'task-a' })).toHaveLength(1);
    expect(await store.listTasks({ parentTaskId: 'missing' })).toHaveLength(0);
    expect(await store.listTasks({ status: 'waiting' })).toHaveLength(1);
    expect(await store.listTasks({ status: ['queued', 'failed'] })).toHaveLength(1);
    expect(await store.findTaskByIdempotencyKey('missing')).toBeNull();
  });

  it('deduplicates outbox operations by idempotency key and applies defaults', async () => {
    const store = createMemoryDurableTaskStore();
    const first = await store.enqueueOutboxOperation({
      url: '/api/tasks',
      idempotencyKey: 'op-1',
    }, 10);
    const duplicate = await store.enqueueOutboxOperation({
      url: '/api/other',
      idempotencyKey: 'op-1',
    }, 20);
    const second = await store.enqueueOutboxOperation({
      id: 'outbox-a',
      url: '/api/tasks-a',
      scheduledFor: 10,
    }, 10);

    expect(duplicate).toEqual(first);
    expect(first).toMatchObject({
      id: 'outbox-0001',
      method: 'POST',
      headers: {},
      body: null,
      maxAttempts: 3,
      scheduledFor: 10,
    });
    expect((await store.snapshot()).outbox).toEqual([first, second]);
    expect(await store.listDueOutboxOperations(9)).toEqual([]);
    expect(await store.listDueOutboxOperations(10, 1)).toEqual([first]);
  });

  it('normalizes non-error throws and falls back when structuredClone is unavailable', () => {
    const original = globalThis.structuredClone;
    Object.defineProperty(globalThis, 'structuredClone', {
      configurable: true,
      value: undefined,
    });
    try {
      expect(cloneValue({ nested: { ok: true } })).toEqual({ nested: { ok: true } });
    } finally {
      Object.defineProperty(globalThis, 'structuredClone', {
        configurable: true,
        value: original,
      });
    }
    const noStack = new Error('without stack');
    Object.defineProperty(noStack, 'stack', { value: '', configurable: true });
    expect(errorToRecord(noStack)).toEqual({ name: 'Error', message: 'without stack' });
    expect(errorToRecord('offline')).toEqual({ name: 'Error', message: 'offline' });
    expect(errorToRecord({ reason: 'unknown' })).toEqual({ name: 'Error', message: '{"reason":"unknown"}' });
  });
});
