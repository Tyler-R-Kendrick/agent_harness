import {
  createDurableTaskRuntime,
  createMemoryDurableTaskStore,
} from '@agent-harness/browser-durable-tasks';
import { describe, expect, it } from 'vitest';
import { createDurableWorkflowAdapter } from '../index.js';

describe('durable workflow adapter', () => {
  it('drives a durable run to success on the default in-memory store', async () => {
    const adapter = createDurableWorkflowAdapter();
    const seen: unknown[] = [];

    const result = await adapter.runDurable({
      id: 'wf-success',
      run: async () => {
        seen.push('ran');
        return 'ok';
      },
    });

    expect(result).toEqual({ id: 'wf-success', status: 'succeeded', attempts: 1 });
    expect(seen).toEqual(['ran']);

    const task = await adapter.runtime.getTask('wf-success');
    expect(task?.status).toBe('completed');
    expect(task?.output).toBe('ok');
  });

  it('retries a failing run and succeeds within maxAttempts', async () => {
    const adapter = createDurableWorkflowAdapter();
    let calls = 0;

    const result = await adapter.runDurable({
      id: 'wf-retry',
      maxAttempts: 3,
      run: async () => {
        calls += 1;
        if (calls < 2) {
          throw new Error('transient failure');
        }
        return 'recovered';
      },
    });

    expect(calls).toBe(2);
    expect(result.status).toBe('succeeded');
    expect(result.attempts).toBe(2);
    expect(result.error).toBeUndefined();
  });

  it('marks the workflow failed with an error once attempts are exhausted', async () => {
    const adapter = createDurableWorkflowAdapter();

    const result = await adapter.runDurable({
      id: 'wf-exhausted',
      maxAttempts: 2,
      run: async () => {
        throw new Error('always fails');
      },
    });

    expect(result).toEqual({
      id: 'wf-exhausted',
      status: 'failed',
      attempts: 2,
      error: 'always fails',
    });
  });

  it('uses an injected store for persistence', async () => {
    const store = createMemoryDurableTaskStore();
    const adapter = createDurableWorkflowAdapter({ store });

    const result = await adapter.runDurable({
      id: 'wf-injected-store',
      run: async () => 42,
    });

    expect(result.status).toBe('succeeded');

    const snapshot = await store.snapshot();
    const persisted = snapshot.tasks.find((task) => task.id === 'wf-injected-store');
    expect(persisted?.status).toBe('completed');
    expect(persisted?.output).toBe(42);
  });

  it('uses an injected runtime and exposes it to callers', async () => {
    const runtime = createDurableTaskRuntime({
      store: createMemoryDurableTaskStore(),
      lockOwner: 'custom-owner',
      retryDelayMs: () => 0,
    });
    const adapter = createDurableWorkflowAdapter({ runtime });

    expect(adapter.runtime).toBe(runtime);

    const result = await adapter.runDurable({
      id: 'wf-injected-runtime',
      run: async () => 'done',
    });

    expect(result.status).toBe('succeeded');

    const task = await runtime.getTask('wf-injected-runtime');
    expect(task?.status).toBe('completed');
  });
});
