import {
  createDurableTaskRuntime,
  createMemoryDurableTaskStore,
  type DurableTaskRecord,
  type DurableTaskRuntime,
} from '@agent-harness/browser-durable-tasks';
import type {
  DurableWorkflowAdapter,
  DurableWorkflowAdapterOptions,
  DurableWorkflowInput,
  DurableWorkflowResult,
} from './types.js';

/** Durable task `type` under which every workflow driven by this adapter is registered. */
const DURABLE_WORKFLOW_TASK_TYPE = 'durable-workflow';
/** Lock owner recorded on records the adapter drives. */
const DURABLE_WORKFLOW_LOCK_OWNER = 'durable-workflow-adapter';

/**
 * Create an opt-in, default-off durable workflow adapter.
 *
 * The adapter wraps a {@link DurableTaskRuntime}. With no options it builds one
 * over an in-memory store; callers may inject their own `store` or a fully
 * configured `runtime`. Retries are driven immediately (zero backoff) so a
 * single `runDurable` call resolves once the workflow reaches a terminal state.
 */
export function createDurableWorkflowAdapter(
  options?: DurableWorkflowAdapterOptions,
): DurableWorkflowAdapter {
  const runtime: DurableTaskRuntime =
    options?.runtime ??
    createDurableTaskRuntime({
      store: options?.store ?? createMemoryDurableTaskStore(),
      lockOwner: DURABLE_WORKFLOW_LOCK_OWNER,
      retryDelayMs: () => 0,
    });

  // Live callbacks are not serializable, so they are held in-process and looked
  // up by durable task id when the runtime executes an attempt.
  const workflowRuns = new Map<string, () => Promise<unknown>>();

  runtime.defineTask({
    type: DURABLE_WORKFLOW_TASK_TYPE,
    run: (context) => workflowRuns.get(context.task.id)!(),
  });

  return {
    runtime,
    async runDurable(input: DurableWorkflowInput): Promise<DurableWorkflowResult> {
      workflowRuns.set(input.id, input.run);
      try {
        let record: DurableTaskRecord = await runtime.enqueue(
          DURABLE_WORKFLOW_TASK_TYPE,
          { workflowId: input.id },
          { id: input.id, maxAttempts: input.maxAttempts },
        );
        while (record.status !== 'completed' && record.status !== 'failed') {
          await runtime.tick();
          record = (await runtime.getTask(input.id))!;
        }
        const result: DurableWorkflowResult = {
          id: record.id,
          status: record.status === 'completed' ? 'succeeded' : 'failed',
          attempts: record.attemptCount,
        };
        if (record.error) {
          result.error = record.error.message;
        }
        return result;
      } finally {
        workflowRuns.delete(input.id);
      }
    },
  };
}
