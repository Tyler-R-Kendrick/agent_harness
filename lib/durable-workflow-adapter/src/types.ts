import type {
  DurableTaskRuntime,
  DurableTaskStore,
} from '@agent-harness/browser-durable-tasks';

/**
 * A single unit of durable work to drive to completion.
 *
 * `run` is the live callback executed on each attempt. It is intentionally a
 * closure (not serialized) — Phase 1 durability is queue-level only. Restoring
 * a live loop across a process boundary is the documented remaining step (see
 * README).
 */
export interface DurableWorkflowInput {
  /** Stable identifier used as the durable task id (also the idempotency anchor). */
  id: string;
  /** Work to execute on each attempt. Throwing triggers durable retry semantics. */
  run: () => Promise<unknown>;
  /** Maximum attempts before the workflow is marked failed. Defaults to the runtime default. */
  maxAttempts?: number;
}

/** Terminal outcome of {@link DurableWorkflowAdapter.runDurable}. */
export interface DurableWorkflowResult {
  id: string;
  status: 'succeeded' | 'failed';
  /** Number of attempts consumed to reach the terminal state. */
  attempts: number;
  /** Failure message from the final attempt, present only when `status` is `'failed'`. */
  error?: string;
}

/** Construction options. Both are optional; omit for an in-memory, default-off adapter. */
export interface DurableWorkflowAdapterOptions {
  /** Persistence layer. Ignored when `runtime` is supplied. Defaults to an in-memory store. */
  store?: DurableTaskStore;
  /** Pre-built runtime for advanced callers. When supplied, `store` is not used. */
  runtime?: DurableTaskRuntime;
}

/** The opt-in durable workflow adapter surface. */
export interface DurableWorkflowAdapter {
  /**
   * Enqueue the input as a durable task, drive it to a terminal state via the
   * runtime, and resolve with the durable outcome. Retries respect `maxAttempts`.
   */
  runDurable(input: DurableWorkflowInput): Promise<DurableWorkflowResult>;
  /** The underlying durable-task runtime, exposed for advanced orchestration. */
  readonly runtime: DurableTaskRuntime;
}
