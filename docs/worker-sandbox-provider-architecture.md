# Extensible Worker and Sandbox Providers

Worker = orchestration boundary  
Sandbox = isolation boundary  
Provider = extension boundary  
Policy = authority boundary  
Capability = discovery and matching boundary  
Artifact store = persistence boundary  
Event stream = observability boundary

## Concepts

Workers coordinate jobs. They may run in a browser host, an extension, a daemon, a service, or a remote environment, but core code only sees `Worker`, `WorkerProvider`, `WorkerJob`, `WorkerRun`, and `WorkerEvent`.

Sandboxes isolate execution. They may be QuickJS WASM, WebContainers, containers, microVMs, remote sandboxes, or something not invented yet, but core code only sees `Sandbox`, `SandboxProvider`, `SandboxBroker`, and `SandboxLease`.

Providers own concrete type identity. Core stores opaque branded strings such as `WorkerTypeId`, `RuntimeTypeId`, and `SandboxTypeId`; it does not use enums, closed unions, or switch statements over concrete implementations.

Capabilities describe what a provider can do. Resolvers match `CapabilityRequirement[]` against open `CapabilitySet`s, including simple equality constraints against capability attributes.

Policy authorizes requested authority before a sandbox is created. `DefaultPolicyEngine` denies direct network, workspace filesystem access, brokered secrets, and previews unless explicitly configured.

## Registering Providers

```ts
import {
  CapExecJavaScript,
  CapFsVirtual,
  DefaultCapabilityMatcher,
  DefaultPolicyEngine,
  DefaultProviderRegistry,
  DefaultSandboxBroker,
  DefaultSandboxResolver,
  DefaultWorkerBroker,
  DefaultWorkerResolver,
  capabilityId,
  jobIntentId,
} from '@agent-harness/worker';
import { QuickJsWasmSandboxProvider } from '@agent-harness/agent-sandbox';
import { BrowserWorkerProvider } from '@agent-harness/worker-browser';

const registry = new DefaultProviderRegistry();
const capabilityMatcher = new DefaultCapabilityMatcher();
const policyEngine = new DefaultPolicyEngine();

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

registry.register(new BrowserWorkerProvider());
registry.register(new QuickJsWasmSandboxProvider());

const worker = await workerBroker.createWorker({
  requiredCapabilities: [{ id: capabilityId('cap.worker.job.skill.create') }],
});

const run = await worker.submit({
  id: crypto.randomUUID(),
  intent: jobIntentId('skill.create'),
  input: {
    prompt: 'Create a CSV normalization skill',
    seedFiles: [],
    commands: ['ls', 'node /skills/csv-normalizer/src/index.js'],
  },
  requirements: {
    sandbox: [
      { id: CapExecJavaScript },
      { id: CapFsVirtual },
    ],
  },
  policy: {
    network: { mode: 'none' },
    filesystem: { mode: 'virtual' },
  },
});

for await (const event of run.events()) {
  console.log(event.type, event.payload);
}

const result = await run.result();
```

## Adding a Worker Provider

Create a workspace under `lib/workers/<name>` and depend on `@agent-harness/worker`. Implement `WorkerProvider`, expose provider-owned IDs with branded constructors, describe open capabilities, and return workers from `createWorker`.

Workers should request isolation through `context.sandboxBroker.createSandbox(...)`. They should not import or instantiate concrete sandbox classes.

## Adding a Sandbox Provider

Keep concrete sandbox runtimes in sandbox packages such as `lib/agent-sandbox`. Implement `SandboxProvider`, expose provider-owned IDs, describe capabilities, and let `DefaultSandboxBroker` evaluate policy before `createSandbox` receives an `effectivePolicy`.

## Deep Agents Adapter

`DeepAgentsSandboxAdapter` wraps any generic `Sandbox` with a small `execute`, `uploadFiles`, and `downloadFiles` surface. It lives as a structural adapter and does not cause core to import Deep Agents.

## Current Providers

`@agent-harness/worker-browser` provides a browser orchestration worker. It accepts generic `WorkerJob` input and, by convention, understands `seedFiles` and `commands`.

`@agent-harness/worker-daemon` adapts message-oriented daemons into workers. It exposes daemon actions through a transport and does not provide arbitrary shell execution.

`@agent-harness/agent-sandbox` now exports `QuickJsWasmSandboxProvider`, a provider adapter over the existing dedicated-worker QuickJS sandbox runtime.
