# @agent-harness/worker

Core provider, capability, policy, worker, sandbox, artifact, and adapter contracts.

The package is implementation-neutral: concrete worker and sandbox type IDs are opaque branded strings owned by provider packages, not enums in core.

## Package boundary

Import public contracts and core runtime helpers from the package root:

```ts
import { DefaultWorkerBroker, providerId, type WorkerProvider } from '@agent-harness/worker';
```

The root export list in `src/index.ts` is explicit so new implementation exports do not become public API accidentally. Do not deep-import `src/*`; those files are packaged only so TypeScript-source consumers can load the documented root entry point.

Run:

```bash
npm --workspace @agent-harness/worker run test:coverage
```
