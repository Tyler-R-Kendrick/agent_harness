# Worker Provider Packages

`lib/workers/` groups the worker-provider packages that build on
[`@agent-harness/worker`](../worker/README.md).

These packages publish separately. This directory exists as a discovery index so
contributors can quickly find the right package before dropping into the
package-specific README.

## Packages

| Package | Import path | Purpose |
|---|---|---|
| [`browser/README.md`](./browser/README.md) | `@agent-harness/worker-browser` | Browser orchestration worker provider that requests sandbox access, seeds conventional files, runs command lists, emits worker events, and releases the sandbox lease. |
| [`daemon/README.md`](./daemon/README.md) | `@agent-harness/worker-daemon` | Daemon-backed worker provider adapter that turns message-oriented daemon actions into generic worker jobs without exposing arbitrary shell execution. |

## When To Use Which Package

- Use `@agent-harness/worker-browser` when the worker needs browser-facing
  sandbox orchestration.
- Use `@agent-harness/worker-daemon` when the worker should talk to a bounded
  daemon action surface instead of running general commands.
- Use [`../worker/README.md`](../worker/README.md) for the shared provider,
  worker, sandbox, capability, and evaluation primitives that both packages
  build on.

## Validation

The package-specific READMEs include their own focused coverage commands:

```bash
npm --workspace @agent-harness/worker-browser run test:coverage
npm --workspace @agent-harness/worker-daemon run test:coverage
```
