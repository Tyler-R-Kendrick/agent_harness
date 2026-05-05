# @agent-harness/logact-loop

LogAct workflow extension for the generic `harness-core` agent event loop.

`harness-core` owns the event-loop kernel: serializable workflow states,
registered event actors, registered event publishers, and lifecycle events.
This package owns the LogAct orchestration that maps that generic runtime to the
driver, voter, decider, executor, and completion-checker roles.

## Package boundary

The package exposes one stable public import path: `@agent-harness/logact-loop`.
Consumers should import the workflow runtime, callback wrappers, hook event
descriptors, and public option types from the root entry point:

```ts
import { runLogActAgentLoop } from '@agent-harness/logact-loop';
```

Deep imports from `@agent-harness/logact-loop/src/*` are internal
implementation details. Source modules under `src/chat-agents/`, `src/hooks.ts`,
`src/logactLoopTypes.ts`, and `src/workflow.ts` may be reorganized without
being treated as stable package contracts.

Published artifacts are intentionally limited to this README, `package.json`,
and runtime TypeScript source files. Tests and local package configuration stay
out of the package tarball.
