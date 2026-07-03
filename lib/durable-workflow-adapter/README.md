# @agent-harness/durable-workflow-adapter

Opt-in, **default-off** adapter that wires the built durable-task runtime
([`@agent-harness/browser-durable-tasks`](../browser-durable-tasks)) into a
minimal durable workflow surface. It is additive: importing or constructing it
changes no existing workflow behavior. Nothing runs durably unless a caller
explicitly routes work through `runDurable`.

## Public entry point

Import from the package root:

```ts
import {
  createDurableWorkflowAdapter,
  type DurableWorkflowInput,
  type DurableWorkflowResult,
} from '@agent-harness/durable-workflow-adapter';
```

Do not deep-import `src/*`; internal file paths are not a stable contract.

## What it provides

- `createDurableWorkflowAdapter(options?)` — returns a `DurableWorkflowAdapter`
  wrapping a `DurableTaskRuntime`.
  - No options: builds a runtime over an in-memory
    `createMemoryDurableTaskStore()`.
  - `{ store }`: builds a runtime over your persistence layer (e.g.
    `createDexieDurableTaskStore(...)` for IndexedDB-backed durability).
  - `{ runtime }`: uses a fully configured runtime you already own.
- `adapter.runDurable(input)` — registers/enqueues the input as a durable task,
  drives it to a terminal state, and resolves with a `DurableWorkflowResult`.
- `adapter.runtime` — the underlying `DurableTaskRuntime`, exposed for advanced
  callers (custom ticking, snapshots, cancellation, lock recovery).

## Minimal example

```ts
import { createDurableWorkflowAdapter } from '@agent-harness/durable-workflow-adapter';

const adapter = createDurableWorkflowAdapter();

const result = await adapter.runDurable({
  id: 'refresh-index',
  maxAttempts: 3,
  run: async () => {
    // ...perform the unit of work; throwing triggers a durable retry.
    return 'ok';
  },
});

// result: { id: 'refresh-index', status: 'succeeded', attempts: 1 }
```

On failure the result is `{ id, status: 'failed', attempts, error }`, where
`error` is the message from the final attempt.

## How completion is awaited (the real runtime surface)

This adapter is built against the actual
`@agent-harness/browser-durable-tasks` API — no invented methods:

- `createDurableTaskRuntime({ store, lockOwner, retryDelayMs })` and
  `createMemoryDurableTaskStore()` for construction.
- `runtime.defineTask({ type, run })` registers a single shared task `type`.
  Because a live `run` callback is not serializable, the adapter holds callbacks
  in-process in a `Map` keyed by durable task id and looks them up inside the
  registered `run(context)` via `context.task.id`.
- `runtime.enqueue(type, input, { id, maxAttempts })` enqueues the workflow.
- `runtime.tick()` executes all due tasks once; the runtime performs the
  transition/lock/retry bookkeeping (`queued → running → completed | queued |
  failed`) and honors `maxAttempts` internally.
- `runtime.getTask(id)` reads the record back after each tick.

`runDurable` enqueues with **zero retry backoff** (`retryDelayMs: () => 0`) for
adapter-owned runtimes, then loops `tick()` + `getTask()` until the record
reaches a terminal `completed` or `failed` status. Retries are therefore driven
synchronously to completion within the single `runDurable` call rather than by a
background scheduler.

## Phase 1 scope and the remaining step

**Phase 1 delivers queue-level durability opt-in only:** enqueue → run → durable
completion/retry, persisted through the injected store. If the process restarts
mid-flight, the durable *record* survives (in a persistent store) and can be
re-driven, but the in-flight LLM/tool loop does not resume from where it paused.

**Remaining step (out of scope for this chunk):** live-loop suspend/resume — the
ability to snapshot and restore an in-progress agent loop across a process
boundary — via `SerializableAgentLoopDefinition` (see
`harness-core/src/eventLoop.ts`) driven through
`runActorWorkflow` (`harness-core/src/actorWorkflow.ts`). That would let a
resumed durable task rehydrate the loop state rather than re-running `run` from
the start.

## Package contents

Published artifacts are limited to this README, `package.json`, and the runtime
TypeScript source under `src/`. Tests and local config are excluded from the
consumer artifact.

## Local development

Run package checks from this directory:

```sh
npm run test
npm run test:coverage
```
