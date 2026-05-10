import { describe, expect, it, vi } from 'vitest';
import {
  createMemoryDurableTaskStore,
  createServiceWorkerOutboxBridge,
  createWorkboxBackgroundSyncRegistration,
} from '../index.js';

describe('durable task network outbox', () => {
  it('flushes queued network operations and retries failed requests with durable attempt state', async () => {
    let now = Date.parse('2026-05-09T17:00:00.000Z');
    const store = createMemoryDurableTaskStore();
    const first = await store.enqueueOutboxOperation({
      url: '/api/merge',
      method: 'POST',
      body: { branch: 'agent/research-1' },
      idempotencyKey: 'merge:agent/research-1',
      maxAttempts: 3,
      scheduledFor: now,
    }, now);
    const second = await store.enqueueOutboxOperation({
      url: '/api/review',
      method: 'PATCH',
      body: { task: 'T-2' },
      idempotencyKey: 'review:T-2',
      maxAttempts: 1,
      scheduledFor: now,
    }, now);
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'offline' })
      .mockResolvedValueOnce({ ok: true, status: 204, text: async () => '' })
      .mockResolvedValueOnce({ ok: true, status: 204, text: async () => '' });

    const bridge = createServiceWorkerOutboxBridge({
      store,
      fetch,
      now: () => now,
      retryDelayMs: (attempt) => attempt * 250,
    });

    await bridge.flush();
    expect(await store.getOutboxOperation(first.id)).toMatchObject({
      status: 'queued',
      attemptCount: 1,
      error: { message: 'HTTP 503: offline' },
      scheduledFor: now + 250,
    });
    expect(await store.getOutboxOperation(second.id)).toMatchObject({ status: 'completed', attemptCount: 1 });

    now += 250;
    await bridge.flush();
    expect(await store.getOutboxOperation(first.id)).toMatchObject({ status: 'completed', attemptCount: 2 });
    expect(fetch).toHaveBeenCalledWith('/api/merge', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Idempotency-Key': 'merge:agent/research-1' }),
      body: JSON.stringify({ branch: 'agent/research-1' }),
    }));
  });

  it('registers Workbox background sync only when Workbox is available', () => {
    const queue = vi.fn();
    const withWorkbox = createWorkboxBackgroundSyncRegistration({
      workbox: { backgroundSync: { Queue: queue } },
      queueName: 'agent-harness-outbox',
    });
    expect(withWorkbox.enabled).toBe(true);
    expect(queue).toHaveBeenCalledWith('agent-harness-outbox');

    const withoutWorkbox = createWorkboxBackgroundSyncRegistration({ workbox: undefined, queueName: 'agent-harness-outbox' });
    expect(withoutWorkbox).toEqual({ enabled: false, queue: null });
  });

  it('uses default timing, headers, and empty-body behavior for simple outbox requests', async () => {
    const store = createMemoryDurableTaskStore();
    await store.enqueueOutboxOperation({
      url: '/api/ping',
      method: 'GET',
      body: null,
    }, 0);
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    const bridge = createServiceWorkerOutboxBridge({ store, fetch });

    const [operation] = await bridge.flush(1);

    expect(operation.status).toBe('completed');
    expect(fetch).toHaveBeenCalledWith('/api/ping', expect.objectContaining({
      method: 'GET',
      body: undefined,
      headers: { 'Content-Type': 'application/json' },
    }));
  });

  it('uses default retry timing and records final network failures', async () => {
    const retryStore = createMemoryDurableTaskStore();
    const retryable = await retryStore.enqueueOutboxOperation({
      url: '/api/retry-default',
      maxAttempts: 2,
    }, 1000);
    await createServiceWorkerOutboxBridge({
      store: retryStore,
      fetch: vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => 'offline' }),
      now: () => 1000,
    }).flush();
    expect(await retryStore.getOutboxOperation(retryable.id)).toMatchObject({
      status: 'queued',
      scheduledFor: 2000,
    });

    const finalStore = createMemoryDurableTaskStore();
    const final = await finalStore.enqueueOutboxOperation({
      url: '/api/final',
      maxAttempts: 1,
      scheduledFor: 1500,
    }, 1000);
    await createServiceWorkerOutboxBridge({
      store: finalStore,
      fetch: vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'broken' }),
      now: () => 1500,
    }).flush();
    expect(await finalStore.getOutboxOperation(final.id)).toMatchObject({
      status: 'failed',
      scheduledFor: 1500,
      error: { message: 'HTTP 500: broken' },
    });
  });

  it('throws when durable outbox state disappears mid-flush', async () => {
    const operation = {
      id: 'missing-op',
      url: '/api/missing',
      method: 'POST',
      headers: {},
      body: null,
      idempotencyKey: null,
      status: 'queued' as const,
      attemptCount: 0,
      maxAttempts: 1,
      createdAt: 0,
      updatedAt: 0,
      scheduledFor: 0,
      startedAt: null,
      completedAt: null,
      error: null,
    };
    const store = {
      listDueOutboxOperations: vi.fn().mockResolvedValue([operation]),
      updateOutboxOperation: vi.fn().mockResolvedValue(null),
    };
    const bridge = createServiceWorkerOutboxBridge({
      store: store as never,
      fetch: vi.fn(),
      now: () => 1,
    });

    await expect(bridge.flush()).rejects.toThrow('Outbox operation missing-op was not found');
  });

  it('throws when completion or final failure cannot be persisted', async () => {
    const operation = {
      id: 'vanishing-op',
      url: '/api/vanish',
      method: 'POST',
      headers: {},
      body: null,
      idempotencyKey: null,
      status: 'queued' as const,
      attemptCount: 0,
      maxAttempts: 1,
      createdAt: 0,
      updatedAt: 0,
      scheduledFor: 0,
      startedAt: null,
      completedAt: null,
      error: null,
    };
    const running = { ...operation, status: 'running' as const, attemptCount: 1 };
    const completionStore = {
      listDueOutboxOperations: vi.fn().mockResolvedValue([operation]),
      updateOutboxOperation: vi.fn()
        .mockResolvedValueOnce(running)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
    };
    await expect(createServiceWorkerOutboxBridge({
      store: completionStore as never,
      fetch: vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => '' }),
      now: () => 1,
    }).flush()).rejects.toThrow('Outbox operation vanishing-op was not found');

    const failureStore = {
      listDueOutboxOperations: vi.fn().mockResolvedValue([operation]),
      updateOutboxOperation: vi.fn()
        .mockResolvedValueOnce(running)
        .mockResolvedValueOnce(null),
    };
    await expect(createServiceWorkerOutboxBridge({
      store: failureStore as never,
      fetch: vi.fn().mockRejectedValue(new Error('offline')),
      now: () => 1,
    }).flush()).rejects.toThrow('Outbox operation vanishing-op was not found');
  });
});
