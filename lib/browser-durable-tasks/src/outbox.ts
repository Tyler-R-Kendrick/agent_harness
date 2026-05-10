import { errorToRecord } from './clone.js';
import type {
  DurableOutboxOperation,
  ServiceWorkerOutboxBridge,
  ServiceWorkerOutboxBridgeOptions,
  WorkboxBackgroundSyncOptions,
  WorkboxBackgroundSyncRegistration,
} from './types.js';

export function createServiceWorkerOutboxBridge(options: ServiceWorkerOutboxBridgeOptions): ServiceWorkerOutboxBridge {
  const now = () => options.now?.() ?? Date.now();
  const retryDelayMs = options.retryDelayMs ?? ((attemptCount: number) => Math.min(60_000, attemptCount * 1_000));

  return {
    async flush(limit = Number.POSITIVE_INFINITY): Promise<DurableOutboxOperation[]> {
      const due = await options.store.listDueOutboxOperations(now(), limit);
      const flushed: DurableOutboxOperation[] = [];
      for (const operation of due) {
        flushed.push(await flushOperation(operation));
      }
      return flushed;
    },
  };

  async function flushOperation(operation: DurableOutboxOperation): Promise<DurableOutboxOperation> {
    const startedAt = now();
    const running = await options.store.updateOutboxOperation(operation.id, () => ({
      status: 'running',
      attemptCount: operation.attemptCount + 1,
      startedAt,
      updatedAt: startedAt,
    }));
    if (!running) throw new Error(`Outbox operation ${operation.id} was not found`);

    try {
      const response = await options.fetch(running.url, {
        method: running.method,
        headers: {
          'Content-Type': 'application/json',
          ...(running.idempotencyKey ? { 'Idempotency-Key': running.idempotencyKey } : {}),
          ...running.headers,
        },
        body: running.body === null ? undefined : JSON.stringify(running.body),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      const completedAt = now();
      const completed = await options.store.updateOutboxOperation(operation.id, () => ({
        status: 'completed',
        completedAt,
        updatedAt: completedAt,
        error: null,
      }));
      if (!completed) throw new Error(`Outbox operation ${operation.id} was not found`);
      return completed;
    } catch (error) {
      const failedAt = now();
      const retryable = running.attemptCount < running.maxAttempts;
      const failed = await options.store.updateOutboxOperation(operation.id, () => ({
        status: retryable ? 'queued' : 'failed',
        scheduledFor: retryable ? failedAt + retryDelayMs(running.attemptCount, running) : running.scheduledFor,
        updatedAt: failedAt,
        error: errorToRecord(error),
      }));
      if (!failed) throw new Error(`Outbox operation ${operation.id} was not found`);
      return failed;
    }
  }
}

export function createWorkboxBackgroundSyncRegistration(
  options: WorkboxBackgroundSyncOptions,
): WorkboxBackgroundSyncRegistration {
  if (!options.workbox?.backgroundSync?.Queue) {
    return { enabled: false, queue: null };
  }
  return {
    enabled: true,
    queue: new options.workbox.backgroundSync.Queue(options.queueName),
  };
}
