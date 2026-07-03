# @agent-harness/worker-daemon

Daemon-backed worker provider.

This package adapts message-oriented daemon actions into generic worker jobs. It is the concrete worker-provider sibling of [`@agent-harness/worker`](../../worker/README.md) for cases where execution must cross a daemon transport boundary instead of requesting a browser sandbox lease.

The adapter intentionally does not expose arbitrary shell execution. Consumers provide a `DaemonTransport` implementation that accepts named actions and optional payloads, and the worker runtime turns those requests into standard worker runs, events, and results.

## Package Boundary

Import from the package root:

```ts
import {
  CapDaemonLocalInference,
  CapDaemonRequest,
  DaemonWorkerProvider,
  type DaemonTransport,
} from '@agent-harness/worker-daemon';
```

The package exposes a single public entry point declared in
[`package.json`](./package.json). Do not deep-import
`@agent-harness/worker-daemon/src/*`; internal file paths are not a stable
consumer contract.

## Public exports

The root module exports the concrete provider and the identifiers that describe its runtime contract:

- `DaemonWorkerProvider`: provider implementation that advertises `SurfaceWorkerProvider` and creates daemon-backed workers.
- `DaemonWorker`: concrete worker implementation returned by `createWorker()`.
- `DaemonWorkerProviderId`, `DaemonWorkerType`, `DaemonRuntimeType`: default provider, worker, and runtime IDs.
- `CapDaemonRequest`, `CapDaemonLocalInference`: default capability markers attached to the provider and worker descriptors.
- `DaemonTransport`: transport interface with `request(action, payload, { signal })`.
- `DaemonWorkerProviderOptions`: provider construction options for overriding IDs, display name, runtime type, or capabilities.

`CapDaemonLocalInference` is a capability marker only. The package does not add special local-inference routing by itself; your transport decides how daemon actions are handled.

## Transport boundary

`DaemonTransport` is the only execution boundary the provider trusts:

```ts
interface DaemonTransport {
  request(action: string, payload: unknown, options?: { signal?: AbortSignal }): Promise<unknown>;
}
```

The provider forwards the `action` and `payload` from each submitted job directly to `transport.request(...)`. This keeps the worker surface generic while letting the daemon remain opinionated about supported actions such as `ping`, `completion`, or model-management requests.

## Minimal daemon worker flow

```ts
import { jobIntentId, type ProviderContext } from '@agent-harness/worker';
import { DaemonWorkerProvider, type DaemonTransport } from '@agent-harness/worker-daemon';

const transport: DaemonTransport = {
  async request(action, payload) {
    return { action, payload, ok: true };
  },
};

const context: ProviderContext = {
  registry: null as never,
  sandboxBroker: null as never,
  policyEngine: null as never,
};

const provider = new DaemonWorkerProvider({ transport });
const worker = await provider.createWorker?.({}, context);
const run = await worker!.submit({
  id: 'job-1',
  intent: jobIntentId('daemon.request'),
  input: { action: 'ping', payload: { nonce: 'abc' } },
});

console.log(await run.result());
```

With the default configuration:

- `describe()` reports `SurfaceWorkerProvider` plus the daemon capability markers.
- `listWorkers()` returns a single template descriptor for the provider's daemon worker type.
- `createWorker()` produces a worker with generated IDs such as `daemon-worker-1`.
- `submit()` emits generic worker events, then converts the daemon response into a string or JSON string result payload.

## Input, output, and failure contract

Submitted job input must be an object with an `action` string and an optional `payload` value:

```ts
{ action: 'ping', payload: { nonce: 'abc' } }
```

Behavior to rely on:

- Invalid input such as `null` or `{ command: 'rm -rf /' }` returns a failed `WorkerResult` with an error diagnostic instead of invoking the daemon transport.
- Successful daemon responses are returned as `output`. String responses stay as-is; non-string responses are JSON-stringified.
- Transport failures are serialized into the `error` field and echoed into diagnostics.
- `run.cancel()` changes the final status to `cancelled`, but it does not stop the underlying transport request by itself.
- To support real upstream cancellation, pass a signal to `submit(..., { signal })` and honor that signal inside your `DaemonTransport`.

This package is a transport adapter, not a policy layer. If you need action allowlists, auth, audit logging, or daemon-side payload validation, enforce them in the daemon transport or the host runtime that constructs it.

## Validation

Run:

```bash
npm --workspace @agent-harness/worker-daemon run test:coverage
```
