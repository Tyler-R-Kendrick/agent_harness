import { cloneValue } from './clone.js';
import type {
  DurableOutboxOperation,
  DurableTaskListFilter,
  DurableTaskRecord,
  DurableTaskSnapshot,
  DurableTaskStore,
} from './types.js';

export interface MemoryDurableTaskStore extends DurableTaskStore {
  kind: 'memory';
}

export function createMemoryDurableTaskStore(): MemoryDurableTaskStore {
  const tasks = new Map<string, DurableTaskRecord>();
  const outbox = new Map<string, DurableOutboxOperation>();
  let outboxSequence = 0;

  const store: MemoryDurableTaskStore = {
    kind: 'memory',
    async putTask(task) {
      const stored = cloneValue(task);
      tasks.set(task.id, stored);
      return cloneValue(stored);
    },
    async getTask(id) {
      return cloneOrNull(tasks.get(id));
    },
    async updateTask(id, updater) {
      const existing = tasks.get(id);
      if (!existing) return null;
      const next = mergeRecord(existing, updater(cloneValue(existing))) as DurableTaskRecord;
      tasks.set(id, cloneValue(next));
      return cloneValue(next);
    },
    async listTasks(filter) {
      return [...tasks.values()]
        .filter((task) => matchesTaskFilter(task, filter))
        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
        .map((task) => cloneValue(task));
    },
    async listRunnableTasks(now, limit = Number.POSITIVE_INFINITY) {
      return [...tasks.values()]
        .filter((task) => task.status === 'queued' && task.scheduledFor <= now)
        .sort((a, b) => a.scheduledFor - b.scheduledFor || a.createdAt - b.createdAt)
        .slice(0, limit)
        .map((task) => cloneValue(task));
    },
    async findTaskByIdempotencyKey(idempotencyKey) {
      return cloneOrNull([...tasks.values()].find((task) => task.idempotencyKey === idempotencyKey));
    },
    async snapshot(): Promise<DurableTaskSnapshot> {
      return {
        tasks: await store.listTasks(),
        outbox: [...outbox.values()]
          .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
          .map((operation) => cloneValue(operation)),
      };
    },
    async enqueueOutboxOperation(input, now) {
      const id = input.id ?? `outbox-${String(++outboxSequence).padStart(4, '0')}`;
      const existing = input.idempotencyKey
        ? [...outbox.values()].find((operation) => operation.idempotencyKey === input.idempotencyKey)
        : undefined;
      if (existing) return cloneValue(existing);
      const operation: DurableOutboxOperation = {
        id,
        url: input.url,
        method: input.method ?? 'POST',
        headers: input.headers ?? {},
        body: input.body ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        status: 'queued',
        attemptCount: 0,
        maxAttempts: input.maxAttempts ?? 3,
        createdAt: now,
        updatedAt: now,
        scheduledFor: input.scheduledFor ?? now,
        startedAt: null,
        completedAt: null,
        error: null,
      };
      outbox.set(id, cloneValue(operation));
      return cloneValue(operation);
    },
    async getOutboxOperation(id) {
      return cloneOrNull(outbox.get(id));
    },
    async updateOutboxOperation(id, updater) {
      const existing = outbox.get(id);
      if (!existing) return null;
      const next = mergeRecord(existing, updater(cloneValue(existing))) as DurableOutboxOperation;
      outbox.set(id, cloneValue(next));
      return cloneValue(next);
    },
    async listDueOutboxOperations(now, limit = Number.POSITIVE_INFINITY) {
      return [...outbox.values()]
        .filter((operation) => operation.status === 'queued' && operation.scheduledFor <= now)
        .sort((a, b) => a.scheduledFor - b.scheduledFor || a.createdAt - b.createdAt)
        .slice(0, limit)
        .map((operation) => cloneValue(operation));
    },
  };

  return store;
}

function cloneOrNull<T>(value: T | undefined): T | null {
  return value ? cloneValue(value) : null;
}

function mergeRecord<T extends { id: string }>(existing: T, next: T | Partial<T>): T {
  return { ...existing, ...next };
}

function matchesTaskFilter(task: DurableTaskRecord, filter?: DurableTaskListFilter): boolean {
  if (!filter) return true;
  if (filter.type && task.type !== filter.type) return false;
  if (filter.parentTaskId !== undefined && task.parentTaskId !== filter.parentTaskId) return false;
  if (!filter.status) return true;
  return Array.isArray(filter.status)
    ? filter.status.includes(task.status)
    : task.status === filter.status;
}
