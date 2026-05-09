# @agent-harness/worker-browser

Browser orchestration worker provider.

The worker requests sandbox access through `SandboxBroker`, uploads conventional seed files, executes conventional command lists, emits generic worker events, and releases the sandbox lease.

## Package boundary

Use the stable root import for browser worker orchestration:

```ts
import { BrowserWorkerProvider } from '@agent-harness/worker-browser';
```

Deep imports from `@agent-harness/worker-browser/src/*` are internal implementation details. The published package includes the README and runtime TypeScript sources, excluding package tests.

Run:

```bash
npm --workspace @agent-harness/worker-browser run test:coverage
```
