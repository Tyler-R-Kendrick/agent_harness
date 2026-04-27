# logact

LogAct agentic reliability primitives backed by a shared append-only log.

Consumers should import from the package root:

```ts
import { InMemoryAgentBus, LogActAgent, QuorumPolicy } from 'logact';
```

## Package Boundary

The package exposes a single public entry point declared in `package.json`.
Deep imports into `src/*` are internal implementation details and should not be
treated as a stable contract.

## Package Contents

The publish allowlist includes only:

- `README.md`
- runtime TypeScript files under `src/**/*.ts`

Tests, coverage output, local config, and generated artifacts are excluded from
the package artifact.

## Validation

Run focused package checks from the repository root:

```sh
npm --workspace logact run test:coverage
npm --workspace logact pack --dry-run
```
