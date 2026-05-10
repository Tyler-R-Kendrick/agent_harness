import { describe, expect, it, vi } from 'vitest';
import {
  createDurableTaskRuntime,
  createMemoryDurableTaskStore,
  type DurableTaskRecord,
} from '../index.js';

describe('durable browser task runtime', () => {
  it('persists task intent before execution, deduplicates idempotency keys, and completes work', async () => {
    let now = Date.parse('2026-05-09T12:00:00.000Z');
    const store = createMemoryDurableTaskStore();
    const runtime = createDurableTaskRuntime({
      store,
      lockOwner: 'tab-a',
      now: () => now,
    });
    const observed: number[] = [];
    const unsubscribe = runtime.observe((snapshot) => observed.push(snapshot.tasks.length));
    const seenDuringRun: DurableTaskRecord[] = [];

    runtime.defineTask({
      type: 'sum',
      maxAttempts: 2,
      run: async ({ task, input }) => {
        const persisted = await store.getTask(task.id);
        if (!persisted) throw new Error('missing persisted task');
        seenDuringRun.push(persisted);
        return { total: input.a + input.b };
      },
    });

    const task = await runtime.enqueue('sum', { a: 2, b: 3 }, {
      idempotencyKey: 'sum:2:3',
      metadata: { feature: 'symphony' },
    });
    const duplicate = await runtime.enqueue('sum', { a: 99, b: 1 }, { idempotencyKey: 'sum:2:3' });
    expect(duplicate.id).toBe(task.id);
    expect(await store.findTaskByIdempotencyKey('sum:2:3')).toMatchObject({ input: { a: 2, b: 3 } });

    now += 10;
    await runtime.tick();
    const completed = await runtime.getTask(task.id);

    expect(seenDuringRun).toHaveLength(1);
    expect(seenDuringRun[0]).toMatchObject({
      id: task.id,
      status: 'running',
      lockOwner: 'tab-a',
      attemptCount: 1,
    });
    expect(completed).toMatchObject({
      status: 'completed',
      output: { total: 5 },
      error: null,
      attemptCount: 1,
      lockOwner: null,
      metadata: { feature: 'symphony' },
    });
    expect(completed?.completedAt).toBe(now);
    expect(observed.length).toBeGreaterThanOrEqual(3);

    unsubscribe();
    const countAfterUnsubscribe = observed.length;
    await runtime.enqueue('sum', { a: 1, b: 1 });
    expect(observed).toHaveLength(countAfterUnsubscribe);
  });

  it('reschedules retryable failures and permanently fails after max attempts', async () => {
    let now = Date.parse('2026-05-09T13:00:00.000Z');
    const runtime = createDurableTaskRuntime({
      store: createMemoryDurableTaskStore(),
      lockOwner: 'tab-b',
      now: () => now,
      retryDelayMs: (attempt) => attempt * 1000,
    });
    let flakyAttempts = 0;
    runtime.defineTask({
      type: 'flaky',
      maxAttempts: 3,
      run: async () => {
        flakyAttempts += 1;
        if (flakyAttempts < 2) throw new Error('temporary offline');
        return 'ok';
      },
    });
    runtime.defineTask({
      type: 'always-broken',
      maxAttempts: 1,
      run: async () => {
        throw new Error('bad patch');
      },
    });

    const flaky = await runtime.enqueue('flaky', {});
    const broken = await runtime.enqueue('always-broken', {});
    await runtime.tick();

    expect(await runtime.getTask(flaky.id)).toMatchObject({
      status: 'queued',
      error: { message: 'temporary offline' },
      attemptCount: 1,
      scheduledFor: now + 1000,
    });
    expect(await runtime.getTask(broken.id)).toMatchObject({
      status: 'failed',
      error: { message: 'bad patch' },
      attemptCount: 1,
    });

    now += 999;
    await runtime.tick();
    expect(await runtime.getTask(flaky.id)).toMatchObject({ status: 'queued', attemptCount: 1 });

    now += 1;
    await runtime.tick();
    expect(await runtime.getTask(flaky.id)).toMatchObject({
      status: 'completed',
      output: 'ok',
      attemptCount: 2,
    });
  });

  it('cancels, retries, updates, and resumes expired running locks without losing state', async () => {
    const now = Date.parse('2026-05-09T14:00:00.000Z');
    const store = createMemoryDurableTaskStore();
    const runtime = createDurableTaskRuntime({
      store,
      lockOwner: 'tab-c',
      now: () => now,
    });
    runtime.defineTask({ type: 'manual', run: async () => null });
    const queued = await runtime.enqueue('manual', { title: 'Draft app shell' });
    const failed = await runtime.enqueue('manual', { title: 'Fix tests' });
    await store.updateTask(failed.id, (task) => ({
      ...task,
      status: 'failed',
      error: { name: 'Error', message: 'lint failed' },
      updatedAt: now - 2,
    }));
    const running = await runtime.enqueue('manual', { title: 'Promote branch' });
    await store.updateTask(running.id, (task) => ({
      ...task,
      status: 'running',
      attemptCount: 1,
      lockedUntil: now - 1,
      lockOwner: 'stale-tab',
      updatedAt: now - 1,
    }));

    await runtime.cancel(queued.id, 'user');
    await runtime.retry(failed.id);
    await runtime.updateTask(failed.id, (task) => ({ metadata: { ...task.metadata, lane: 'rework' } }));
    const resumed = await runtime.resumeExpiredLocks();

    expect(resumed.map((task) => task.id)).toEqual([running.id]);
    expect(await runtime.getTask(queued.id)).toMatchObject({
      status: 'cancelled',
      cancelledAt: now,
      metadata: { cancelledBy: 'user' },
    });
    expect(await runtime.getTask(failed.id)).toMatchObject({
      status: 'queued',
      error: null,
      metadata: { lane: 'rework' },
    });
    expect(await runtime.getTask(running.id)).toMatchObject({
      status: 'queued',
      lockOwner: null,
      lockedUntil: null,
    });
  });

  it('throws clear errors for unknown task definitions and missing task ids', async () => {
    const runtime = createDurableTaskRuntime({
      store: createMemoryDurableTaskStore(),
      lockOwner: 'tab-d',
      now: () => Date.parse('2026-05-09T15:00:00.000Z'),
    });
    await expect(runtime.enqueue('missing', {})).rejects.toThrow('No durable task definition registered for missing');
    await expect(runtime.cancel('missing-task')).rejects.toThrow('Durable task missing-task was not found');
    await expect(runtime.retry('missing-task')).rejects.toThrow('Durable task missing-task was not found');
    await expect(runtime.updateTask('missing-task', () => ({}))).rejects.toThrow('Durable task missing-task was not found');
  });

  it('leaves active locks alone and reports vanished tasks during execution', async () => {
    const now = Date.parse('2026-05-09T15:30:00.000Z');
    const store = createMemoryDurableTaskStore();
    const runtime = createDurableTaskRuntime({
      store,
      lockOwner: 'tab-vanish',
      now: () => now,
    });
    runtime.defineTask({ type: 'noop', run: async () => 'done' });
    const unlocked = await runtime.enqueue('noop', {});
    const active = await runtime.enqueue('noop', {});
    await store.updateTask(unlocked.id, (task) => ({
      ...task,
      status: 'running',
      lockedUntil: null,
    }));
    await store.updateTask(active.id, (task) => ({
      ...task,
      status: 'running',
      lockedUntil: now + 100,
    }));

    expect(await runtime.resumeExpiredLocks()).toEqual([]);

    const vanished = await runtime.enqueue('noop', {});
    const vanishingStore = {
      ...createMemoryDurableTaskStore(),
      listRunnableTasks: async () => [vanished],
      updateTask: async () => null,
      snapshot: async () => ({ tasks: [], outbox: [] }),
    };
    const vanishingRuntime = createDurableTaskRuntime({
      store: vanishingStore,
      lockOwner: 'tab-vanish',
      now: () => now,
    });
    vanishingRuntime.defineTask({ type: 'noop', run: async () => 'done' });
    await expect(vanishingRuntime.tick()).rejects.toThrow(`Durable task ${vanished.id} was not found`);

    const expired = { ...active, lockedUntil: now - 1 };
    const resumeStore = {
      ...createMemoryDurableTaskStore(),
      listTasks: async () => [expired],
      updateTask: async () => null,
      snapshot: async () => ({ tasks: [], outbox: [] }),
    };
    const resumeRuntime = createDurableTaskRuntime({
      store: resumeStore,
      lockOwner: 'tab-vanish',
      now: () => now,
    });
    expect(await resumeRuntime.resumeExpiredLocks()).toEqual([]);
  });

  it('reports vanished tasks after handler success or failure', async () => {
    const now = Date.parse('2026-05-09T15:45:00.000Z');
    const runnable = await createMemoryDurableTaskStore().putTask({
      id: 'task-vanishing',
      type: 'vanish',
      status: 'queued',
      input: {},
      output: null,
      error: null,
      attemptCount: 0,
      maxAttempts: 1,
      createdAt: now,
      updatedAt: now,
      scheduledFor: now,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      lockedUntil: null,
      lockOwner: null,
      idempotencyKey: null,
      parentTaskId: null,
      metadata: {},
    });
    const running = { ...runnable, status: 'running' as const, attemptCount: 1 };
    const successStore = {
      ...createMemoryDurableTaskStore(),
      listRunnableTasks: async () => [runnable],
      updateTask: vi.fn().mockResolvedValueOnce(running).mockResolvedValueOnce(null).mockResolvedValueOnce(null),
      snapshot: async () => ({ tasks: [], outbox: [] }),
    };
    const successRuntime = createDurableTaskRuntime({ store: successStore, lockOwner: 'tab', now: () => now });
    successRuntime.defineTask({ type: 'vanish', run: async () => 'ok' });
    await expect(successRuntime.tick()).rejects.toThrow('Durable task task-vanishing was not found');

    const failureStore = {
      ...createMemoryDurableTaskStore(),
      listRunnableTasks: async () => [runnable],
      updateTask: vi.fn().mockResolvedValueOnce(running).mockResolvedValueOnce(null),
      snapshot: async () => ({ tasks: [], outbox: [] }),
    };
    const failureRuntime = createDurableTaskRuntime({ store: failureStore, lockOwner: 'tab', now: () => now });
    failureRuntime.defineTask({
      type: 'vanish',
      run: async () => {
        throw new Error('nope');
      },
    });
    await expect(failureRuntime.tick()).rejects.toThrow('Durable task task-vanishing was not found');
  });

  it('uses default runtime clock, retry delay, and lock duration when no browser options are supplied', async () => {
    const runtime = createDurableTaskRuntime({
      store: createMemoryDurableTaskStore(),
      lockOwner: 'default-tab',
    });
    runtime.defineTask({
      type: 'default-fail',
      maxAttempts: 2,
      run: async ({ task }) => {
        expect(task.lockedUntil! - task.startedAt!).toBe(30000);
        throw new Error('retry with defaults');
      },
    });

    const task = await runtime.enqueue('default-fail', {});
    await runtime.tick();
    const retry = await runtime.getTask(task.id);

    expect(retry).toMatchObject({
      status: 'queued',
      attemptCount: 1,
      error: { message: 'retry with defaults' },
    });
    expect(retry!.scheduledFor).toBe(retry!.updatedAt + 1000);
  });

  it('exposes immutable task snapshots and filters due runnable tasks', async () => {
    const now = Date.parse('2026-05-09T16:00:00.000Z');
    const store = createMemoryDurableTaskStore();
    const runtime = createDurableTaskRuntime({
      store,
      lockOwner: 'tab-e',
      now: () => now,
    });
    runtime.defineTask({ type: 'noop', run: async () => 'done' });
    const ready = await runtime.enqueue('noop', {}, { scheduledFor: now });
    await runtime.enqueue('noop', {}, { scheduledFor: now + 5000 });
    await runtime.cancel(ready.id);

    const snapshot = await runtime.snapshot();
    snapshot.tasks.push({ ...ready, id: 'mutated' });

    expect((await runtime.snapshot()).tasks.map((task) => task.id)).not.toContain('mutated');
    expect(await runtime.listTasks({ status: 'cancelled' })).toHaveLength(1);
    expect(await store.listRunnableTasks(now)).toHaveLength(0);
  });
});
