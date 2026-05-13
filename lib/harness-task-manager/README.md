# Harness Task Manager

Harness Task Manager provides the internal Agent Harness task/state manager built on Browser Durable Tasks. It stores harness-managed task metadata, review state, merge state, activity history, and autopilot controls through a durable task runtime.

Use it when Agent Harness surfaces need an internal task board or workflow state layer without introducing a separate service-side task store.

## Package boundary

Use the stable root import for task manager APIs:

```ts
import { createHarnessTaskManager } from '@agent-harness/task-manager';
```

The public package boundary is the root export. Source subpaths such as `@agent-harness/task-manager/src/*` are private implementation details and may change without a compatibility guarantee.

The npm package intentionally publishes `README.md` and runtime TypeScript sources only. Tests, coverage output, build output, and local cache artifacts are excluded by the package `files` allowlist and repository ignore rules.

## Validation

Run:

```powershell
npm.cmd --workspace @agent-harness/task-manager run test:coverage
```

The package enforces 100% statement, branch, function, and line coverage.
