# @agent-harness/worker

Core provider, capability, policy, worker, sandbox, artifact, and adapter contracts for Agent Harness runtime integrations.

The package is implementation-neutral: concrete worker, runtime, provider, and sandbox type ids are opaque branded strings owned by provider packages, not enums in core.

## Package boundary

Import public contracts and runtime helpers from the package root:

```ts
import {
  DefaultWorkerBroker,
  DefaultWorkerResolver,
  InMemoryArtifactStore,
  providerId,
  type WorkerProvider,
} from '@agent-harness/worker';
```

The root export list in `src/index.ts` is explicit so new implementation exports do not become public API accidentally. Do not deep-import `src/*`; those files are packaged only so TypeScript-source consumers can load the documented root entry point.

## Core building blocks

- `DefaultCapabilitySet` and `DefaultCapabilityMatcher` describe what a worker or sandbox can do and score requests against required capabilities.
- `DefaultPolicyEngine` turns requested network, filesystem, execution, preview, and secret policies into an allow or deny decision plus an effective policy snapshot.
- `DefaultProviderRegistry` keeps worker and sandbox providers discoverable through a shared registry.
- `DefaultSandboxBroker` resolves a matching sandbox provider, applies policy, and returns a releasable sandbox lease.
- `DefaultWorkerBroker` resolves a matching worker provider and creates or reconnects workers through the same shared provider context.
- `InMemoryArtifactStore` is the default artifact store for job outputs, diagnostics, and metadata during local tests or in-memory hosts.
- `DeepAgentsSandboxAdapter` exposes a small Deep-Agents-shaped wrapper over a `Sandbox` for command execution plus optional file upload and download.

## Minimal worker and sandbox flow

Most hosts wire the package in three layers: register providers, define policy defaults, then create brokers that select the best worker or sandbox for a request.

```ts
import {
  CapExecJavaScript,
  DefaultCapabilityMatcher,
  DefaultPolicyEngine,
  DefaultProviderRegistry,
  DefaultSandboxBroker,
  DefaultSandboxResolver,
  DefaultWorkerBroker,
  DefaultWorkerResolver,
} from '@agent-harness/worker';

const registry = new DefaultProviderRegistry();

registry.register(mySandboxProvider);
registry.register(myWorkerProvider);

const capabilityMatcher = new DefaultCapabilityMatcher();
const policyEngine = new DefaultPolicyEngine({
  allowedNetworkModes: ['none'],
  allowWorkspaceFilesystem: false,
});

const sandboxBroker = new DefaultSandboxBroker({
  registry,
  resolver: new DefaultSandboxResolver(capabilityMatcher),
  policyEngine,
});

const workerBroker = new DefaultWorkerBroker({
  registry,
  resolver: new DefaultWorkerResolver(capabilityMatcher),
  sandboxBroker,
  policyEngine,
});

const sandboxLease = await sandboxBroker.createSandbox({
  requiredCapabilities: [{ id: CapExecJavaScript }],
});

const worker = await workerBroker.createWorker({
  requiredCapabilities: [{ id: CapExecJavaScript }],
});

await sandboxLease.release();
```

`createSandbox()` returns a `SandboxLease`, not just a sandbox instance, so hosts can keep the effective policy and lifecycle cleanup attached to the same handle. `createWorker()` returns the matched provider's `Worker` implementation directly.

## Capability and policy contracts

Capabilities are plain ids with optional version and attributes, so provider packages can add environment-specific metadata without changing the shared contract.

```ts
import {
  CapFsWorkspaceScoped,
  DefaultCapabilityMatcher,
  DefaultCapabilitySet,
  capabilityId,
} from '@agent-harness/worker';

const available = new DefaultCapabilitySet([
  { id: CapFsWorkspaceScoped, attributes: { maxRoots: 2 } },
  { id: capabilityId('cap.preview.image') },
]);

const match = new DefaultCapabilityMatcher().satisfies(available, [
  { id: CapFsWorkspaceScoped, constraints: { maxRoots: 2 } },
]);
```

`DefaultPolicyEngine` is deny-by-default. Without explicit options it allows no network, no brokered secrets, no preview access, and only virtual filesystem mode. Hosts opt into broader access by configuration rather than by provider declaration alone.

## Provider descriptors and artifacts

Providers advertise their reusable surface through `describe()`, optional `listWorkers()` or `listSandboxes()`, and creation or connection methods:

- `ProviderDescriptor.provides` declares provider surfaces such as `surface.worker-provider` or `surface.sandbox-provider`.
- `WorkerDescriptor.runtime.capabilities` and `SandboxDescriptor.capabilities` are what the resolvers score against request requirements.
- `labels` and `annotations` let hosts attach routing or UI metadata without widening the shared type system.

Artifacts and diagnostics are kept generic on purpose. `WorkerResult` can include structured `artifacts`, `diagnostics`, `metrics`, and serialized errors so higher-level packages can project the same result into browser UI, logs, or eval fixtures.

## Validation

Run:

```bash
npm --workspace @agent-harness/worker run test:coverage
```
