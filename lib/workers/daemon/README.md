# @agent-harness/worker-daemon

Daemon-backed worker provider.

This adapter turns message-oriented daemon actions into generic worker jobs. It intentionally does not expose arbitrary shell execution.

## Package Boundary

Import from the package root:

```ts
import { DaemonWorkerProvider } from '@agent-harness/worker-daemon';
```

The package exposes a single public entry point declared in
[`package.json`](./package.json). Do not deep-import
`@agent-harness/worker-daemon/src/*`; internal file paths are not a stable
consumer contract.

Run:

```bash
npm --workspace @agent-harness/worker-daemon run test:coverage
```
