# Browser Durable Tasks

Browser Durable Tasks provides browser-native durable task state management for Agent Harness. It combines a durable task runtime, an in-memory test store, a Dexie-backed IndexedDB store, an XState task machine, and service-worker outbox helpers.

Use it when browser-hosted agents need resumable queued work, retryable task execution, persisted task snapshots, or network outbox flushing without introducing a server-side queue.

## Package boundary

Use the stable root import for task runtime APIs:

```ts
import { createDurableTaskRuntime } from '@agent-harness/browser-durable-tasks';
```

The public package boundary is the root export. Source subpaths such as `@agent-harness/browser-durable-tasks/src/*` are private implementation details and may change without a compatibility guarantee.

The npm package intentionally publishes `README.md` and runtime TypeScript sources only. Tests, coverage output, build output, and local cache artifacts are excluded by the package `files` allowlist and repository ignore rules.

## Validation

Run:

```powershell
npm.cmd --workspace @agent-harness/browser-durable-tasks run test:coverage
```

The package enforces 100% statement, branch, function, and line coverage.
