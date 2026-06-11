# Browser Durable Tasks

Browser Durable Tasks provides browser-native durable task state management for Agent Harness. It combines a durable task runtime, an in-memory test store, a Dexie-backed IndexedDB store, an XState task machine, and service-worker outbox helpers.

Use it when browser-hosted agents need resumable queued work, retryable task execution, persisted task snapshots, or network outbox flushing without introducing a server-side queue.

## Core building blocks

- `createDurableTaskRuntime(...)`: registers task definitions, persists queued work, executes due tasks, and exposes snapshot listeners.
- `createMemoryDurableTaskStore()`: deterministic in-memory store for tests, local fixtures, and non-persistent flows.
- `createDexieDurableTaskStore(...)`: IndexedDB-backed browser store shape for persistent task and outbox state.
- `createDurableTaskMachine(...)` and `transitionDurableTaskStatus(...)`: explicit task-state transitions for queued, running, waiting, completed, failed, and cancelled work.
- `createServiceWorkerOutboxBridge(...)`: flushes durable HTTP operations with persisted retry state.
- `createWorkboxBackgroundSyncRegistration(...)`: optional Workbox queue registration when a service worker runtime exposes Workbox.

## Minimal runtime flow

```ts
import {
  createDurableTaskRuntime,
  createMemoryDurableTaskStore,
} from '@agent-harness/browser-durable-tasks';

const runtime = createDurableTaskRuntime({
  store: createMemoryDurableTaskStore(),
  lockOwner: 'tab-a',
});

runtime.defineTask({
  type: 'sum',
  run: async ({ input }) => ({ total: input.a + input.b }),
});

const task = await runtime.enqueue('sum', { a: 2, b: 3 }, {
  idempotencyKey: 'sum:2:3',
  metadata: { feature: 'demo' },
});

await runtime.tick();

const completed = await runtime.getTask(task.id);
console.log(completed?.status, completed?.output);
```

`enqueue()` persists task intent before execution. `tick()` only runs due queued tasks, so callers can control execution from the UI thread, a worker, or a background coordinator.

## Runtime and persistence semantics

- Tasks are durably recorded with `status`, attempt counters, timestamps, `idempotencyKey`, optional `parentTaskId`, and arbitrary `metadata`.
- `enqueue()` deduplicates on `idempotencyKey` before creating a second task record.
- `tick()` locks each runnable task to the configured `lockOwner`, increments `attemptCount`, and clears the lock when the handler completes or fails.
- Retryable failures return the task to `queued` and reschedule it with `retryDelayMs`; final failures stay `failed` with a serialized error record.
- `cancel()` and `retry()` enforce the XState-backed status machine, so completed and cancelled tasks cannot be reopened accidentally.
- `resumeExpiredLocks()` moves stale `running` tasks back to `queued` when `lockedUntil` has expired.
- `observe()` emits full snapshots after task and outbox mutations so React or other local subscribers can stay synchronized.

## Outbox and background sync

Use the outbox bridge when a durable task flow also needs persisted HTTP side effects:

```ts
import {
  createMemoryDurableTaskStore,
  createServiceWorkerOutboxBridge,
} from '@agent-harness/browser-durable-tasks';

const store = createMemoryDurableTaskStore();
await store.enqueueOutboxOperation({
  url: '/api/review',
  method: 'PATCH',
  body: { taskId: 'T-1', status: 'approved' },
  idempotencyKey: 'review:T-1',
}, Date.now());

const outbox = createServiceWorkerOutboxBridge({
  store,
  fetch,
});

await outbox.flush();
```

`createServiceWorkerOutboxBridge()` adds a JSON `Content-Type` header, forwards `Idempotency-Key` when present, and persists retry timing for transient failures. `createWorkboxBackgroundSyncRegistration()` only enables queue registration when Workbox is actually available, so browser code can degrade gracefully outside a service-worker runtime.

## Package boundary

Use the stable root import for task runtime APIs:

```ts
import { createDurableTaskRuntime } from '@agent-harness/browser-durable-tasks';
```

The public package boundary is the root export. Source subpaths such as `@agent-harness/browser-durable-tasks/src/*` are private implementation details and may change without a compatibility guarantee.

The npm package intentionally publishes `README.md` and runtime TypeScript sources only. Tests, coverage output, build output, and local cache artifacts are excluded by the package `files` allowlist and repository ignore rules.

## Failure modes and limits

- `enqueue()` throws if no task definition has been registered for the requested `type`.
- `cancel()`, `retry()`, and `updateTask()` throw when the target task id is missing.
- Runtime handlers must be idempotent with respect to retries because failed tasks can be re-queued automatically.
- The Dexie store adapter defines the IndexedDB schema and store shape, but callers still own browser lifecycle concerns such as opening the app in a context where IndexedDB is available.

## Validation

Run:

```powershell
npm.cmd --workspace @agent-harness/browser-durable-tasks run test:coverage
```

The package enforces 100% statement, branch, function, and line coverage.
