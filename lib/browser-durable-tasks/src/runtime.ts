import { errorToRecord } from './clone.js';
import type {
  DurableTaskDefinition,
  DurableTaskListFilter,
  DurableTaskRecord,
  DurableTaskRuntime,
  DurableTaskRuntimeOptions,
  DurableTaskSnapshot,
  DurableTaskSnapshotListener,
  EnqueueDurableTaskOptions,
} from './types.js';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_LOCK_DURATION_MS = 30_000;

export function createDurableTaskRuntime(options: DurableTaskRuntimeOptions): DurableTaskRuntime {
  const definitions = new Map<string, DurableTaskDefinition>();
  const listeners = new Set<DurableTaskSnapshotListener>();
  let taskSequence = 0;

  const currentTime = () => options.now?.() ?? Date.now();
  const lockDurationMs = options.lockDurationMs ?? DEFAULT_LOCK_DURATION_MS;
  const retryDelayMs = options.retryDelayMs ?? ((attemptCount: number) => Math.min(60_000, attemptCount * 1_000));

  const runtime: DurableTaskRuntime = {
    defineTask(definition) {
      definitions.set(definition.type, definition as DurableTaskDefinition);
    },
    async enqueue<TInput = unknown, TMetadata extends Record<string, unknown> = Record<string, unknown>>(
      type: string,
      input: TInput,
      enqueueOptions: EnqueueDurableTaskOptions<TMetadata> = {},
    ): Promise<DurableTaskRecord<TInput>> {
      const definition = definitionFor(type, definitions);
      if (enqueueOptions.idempotencyKey) {
        const existing = await options.store.findTaskByIdempotencyKey(enqueueOptions.idempotencyKey);
        if (existing) return existing as DurableTaskRecord<TInput>;
      }
      const now = currentTime();
      const task: DurableTaskRecord<TInput> = {
        id: enqueueOptions.id ?? `task-${String(++taskSequence).padStart(4, '0')}`,
        type,
        status: 'queued',
        input,
        output: null,
        error: null,
        attemptCount: 0,
        maxAttempts: enqueueOptions.maxAttempts ?? definition.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        createdAt: now,
        updatedAt: now,
        scheduledFor: enqueueOptions.scheduledFor ?? now,
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
        lockedUntil: null,
        lockOwner: null,
        idempotencyKey: enqueueOptions.idempotencyKey ?? null,
        parentTaskId: enqueueOptions.parentTaskId ?? null,
        metadata: enqueueOptions.metadata ?? {},
      };
      const persisted = await options.store.putTask(task);
      await emit();
      return persisted as DurableTaskRecord<TInput>;
    },
    async getTask(id) {
      return options.store.getTask(id);
    },
    async listTasks(filter?: DurableTaskListFilter) {
      return options.store.listTasks(filter);
    },
    async updateTask(id, updater) {
      const now = currentTime();
      const updated = await options.store.updateTask(id, (task) => ({
        ...updater(task),
        updatedAt: now,
      }));
      if (!updated) throw new Error(`Durable task ${id} was not found`);
      await emit();
      return updated;
    },
    async cancel(id, cancelledBy) {
      const now = currentTime();
      const updated = await options.store.updateTask(id, (task) => ({
        status: 'cancelled',
        cancelledAt: now,
        lockOwner: null,
        lockedUntil: null,
        updatedAt: now,
        metadata: {
          ...task.metadata,
          ...(cancelledBy ? { cancelledBy } : {}),
        },
      }));
      if (!updated) throw new Error(`Durable task ${id} was not found`);
      await emit();
      return updated;
    },
    async retry(id) {
      const now = currentTime();
      const updated = await options.store.updateTask(id, () => ({
        status: 'queued',
        error: null,
        lockOwner: null,
        lockedUntil: null,
        scheduledFor: now,
        updatedAt: now,
      }));
      if (!updated) throw new Error(`Durable task ${id} was not found`);
      await emit();
      return updated;
    },
    async resumeExpiredLocks() {
      const now = currentTime();
      const running = await options.store.listTasks({ status: 'running' });
      const resumed: DurableTaskRecord[] = [];
      for (const task of running) {
        if (task.lockedUntil === null || task.lockedUntil > now) continue;
        const updated = await options.store.updateTask(task.id, () => ({
          status: 'queued',
          lockOwner: null,
          lockedUntil: null,
          updatedAt: now,
        }));
        if (updated) resumed.push(updated);
      }
      if (resumed.length > 0) await emit();
      return resumed;
    },
    async tick(limit = Number.POSITIVE_INFINITY) {
      const now = currentTime();
      const dueTasks = await options.store.listRunnableTasks(now, limit);
      const results: DurableTaskRecord[] = [];
      for (const task of dueTasks) {
        results.push(await executeTask(task));
      }
      return results;
    },
    async snapshot(): Promise<DurableTaskSnapshot> {
      return options.store.snapshot();
    },
    observe(listener) {
      listeners.add(listener);
      void options.store.snapshot().then(listener);
      return () => listeners.delete(listener);
    },
  };

  async function executeTask(task: DurableTaskRecord): Promise<DurableTaskRecord> {
    const definition = definitionFor(task.type, definitions);
    const now = currentTime();
    const running = await options.store.updateTask(task.id, () => ({
      status: 'running',
      startedAt: now,
      updatedAt: now,
      lockedUntil: now + lockDurationMs,
      lockOwner: options.lockOwner,
      attemptCount: task.attemptCount + 1,
    }));
    if (!running) throw new Error(`Durable task ${task.id} was not found`);
    await emit();
    try {
      const output = await definition.run({
        task: running,
        input: running.input,
      });
      const completedAt = currentTime();
      const completed = await options.store.updateTask(task.id, () => ({
        status: 'completed',
        output,
        error: null,
        completedAt,
        updatedAt: completedAt,
        lockOwner: null,
        lockedUntil: null,
      }));
      if (!completed) throw new Error(`Durable task ${task.id} was not found`);
      await emit();
      return completed;
    } catch (error) {
      const failedAt = currentTime();
      const retryable = running.attemptCount < running.maxAttempts;
      const failed = await options.store.updateTask(task.id, () => ({
        status: retryable ? 'queued' : 'failed',
        error: errorToRecord(error),
        scheduledFor: retryable ? failedAt + retryDelayMs(running.attemptCount, running) : running.scheduledFor,
        updatedAt: failedAt,
        lockOwner: null,
        lockedUntil: null,
      }));
      if (!failed) throw new Error(`Durable task ${task.id} was not found`);
      await emit();
      return failed;
    }
  }

  async function emit(): Promise<void> {
    if (listeners.size === 0) return;
    const snapshot = await options.store.snapshot();
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  return runtime;
}

function definitionFor(type: string, definitions: Map<string, DurableTaskDefinition>): DurableTaskDefinition {
  const definition = definitions.get(type);
  if (!definition) throw new Error(`No durable task definition registered for ${type}`);
  return definition;
}
