# ralph-loop

Ralph Loop completion heuristics for iterative agent task execution.

This package provides a small `logact`-compatible completion checker that
distinguishes execution tasks from plan-only or explanatory tasks, then asks the
agent to keep going when an execution workflow returns only next steps, future
tense, or empty output.

## Public Entry Point

Import from the package root:

```ts
import {
  PLAN_ONLY_PATTERN,
  createHeuristicCompletionChecker,
  isExecutionTask,
  looksLikePlanOnly,
} from 'ralph-loop';
```

The package exposes a single public entry point declared in
[`package.json`](./package.json). Do not deep-import `src/*`; internal file
paths are not a stable contract.

## What It Provides

- `createHeuristicCompletionChecker(task)`: returns a `logact`
  `ICompletionChecker` that marks empty or plan-only execution results as
  incomplete and emits retry guidance.
- `isExecutionTask(task)`: detects requests that imply implementation work, such
  as fixing, building, running, wiring, or completing something.
- `looksLikePlanOnly(output)`: flags outputs that are only a plan, next steps,
  follow-up, or future-tense intent without completion evidence.
- `PLAN_ONLY_PATTERN`: exported regex for callers or tests that need the same
  plan-only matching semantics.

## Minimal Example

```ts
import { InMemoryAgentBus, LogActAgent, QuorumPolicy } from 'logact';
import { createHeuristicCompletionChecker, isExecutionTask } from 'ralph-loop';

const task = 'Implement the fix and run the tests.';
const bus = new InMemoryAgentBus();

const agent = new LogActAgent({
  bus,
  inferenceClient: {
    async infer(messages) {
      return messages.at(-1)?.content ?? '';
    },
  },
  quorumPolicy: QuorumPolicy.OnByDefault,
  completionChecker: isExecutionTask(task)
    ? createHeuristicCompletionChecker(task)
    : undefined,
  maxTurns: 2,
});

await agent.send(task);
await agent.run();
```

Expected behavior:

- Execution-oriented prompts receive a completion checker automatically.
- Empty output or a response like `Plan:` or `I will fix this next` is treated
  as incomplete.
- A response with completion evidence like `Implemented the fix and verified the
  tests pass.` is treated as done.
- Planning-only tasks can skip the heuristic gate by checking
  `isExecutionTask(task)` first.

## Runtime Dependency

`ralph-loop` depends on the public completion-checker contracts exported by
`logact`. Consumers should install a compatible `logact` version alongside this
package when it is used outside this workspace.

## Package Contents

Published package artifacts are limited to this README, `package.json`, and the
runtime TypeScript source files under `src/`. Tests and local package config are
excluded from the consumer artifact.

## Local Development

Run focused package checks from the repository root:

```sh
npm --workspace ralph-loop run test:coverage
npm --workspace ralph-loop pack --dry-run
```

`vitest.config.ts` enforces 100% lines, branches, functions, and statements
coverage for the package source files.
