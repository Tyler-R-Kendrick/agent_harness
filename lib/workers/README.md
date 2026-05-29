# Worker Provider Packages

`lib/workers/` is a workspace container for the concrete worker-provider packages that build on the shared contracts in [`@agent-harness/worker`](../worker/README.md).

## Packages

| Package | Import path | Purpose |
| --- | --- | --- |
| [`browser/README.md`](./browser/README.md) | `@agent-harness/worker-browser` | Browser orchestration provider that requests sandbox leases, uploads conventional seed files, runs command lists, and emits generic worker events. |
| [`daemon/README.md`](./daemon/README.md) | `@agent-harness/worker-daemon` | Daemon-backed provider that converts message-oriented daemon actions into generic worker jobs without exposing arbitrary shell execution. |

## When To Use Which Package

- Use `@agent-harness/worker-browser` when a worker needs governed browser-side sandbox orchestration.
- Use `@agent-harness/worker-daemon` when a worker should delegate execution through a daemon transport boundary.
- Use [`@agent-harness/worker`](../worker/README.md) when you need the shared provider, capability, or evaluation primitives without choosing a concrete transport yet.

## Validation

Run the focused package coverage command for the package you changed:

```bash
npm --workspace @agent-harness/worker-browser run test:coverage
npm --workspace @agent-harness/worker-daemon run test:coverage
```
