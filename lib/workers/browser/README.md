# @agent-harness/worker-browser

Browser orchestration worker provider for `@agent-harness/worker`.

It adapts browser-managed sandbox leases into the generic worker contract. The provider requests a sandbox through `SandboxBroker`, uploads optional seed files, executes a conventional command list, emits standard worker lifecycle events, and releases the sandbox lease when the run completes or fails.

## Public surface

Import from the package root:

```ts
import {
  BrowserWorkerProvider,
  BrowserWorkerProviderId,
  BrowserWorkerType,
  BrowserRuntimeType,
  CapWorkerJobSkillCreate,
  CapWorkerSandboxOrchestration,
} from '@agent-harness/worker-browser';
```

The stable API is the root export declared in [`package.json`](./package.json). Do not deep-import `@agent-harness/worker-browser/src/*`; those files are internal implementation details. The published package includes this README and runtime TypeScript sources, excluding package tests.

## What the provider advertises

`BrowserWorkerProvider` describes a worker-provider surface with:

- `BrowserWorkerProviderId`: provider id for browser-backed worker orchestration.
- `BrowserWorkerType`: opaque worker type for created browser workers.
- `BrowserRuntimeType`: runtime type reported by worker descriptors.
- `CapWorkerJobSkillCreate`: capability id for skill-creation style jobs.
- `CapWorkerSandboxOrchestration`: capability id for sandbox-orchestration jobs.
- `CapFsVirtual`: virtual filesystem support enabled by the provider's default capability set.

You can override the provider id, display name, or capability set through `BrowserWorkerProviderOptions` when embedding the provider in a larger registry.

## Minimal flow

```ts
import { jobIntentId } from '@agent-harness/worker';
import { BrowserWorkerProvider } from '@agent-harness/worker-browser';

const provider = new BrowserWorkerProvider();
const worker = await provider.createWorker({}, context);

const run = await worker.submit({
  id: 'job-1',
  intent: jobIntentId('skill.create'),
  input: {
    seedFiles: [{ path: '/skills/input.txt', content: 'hello' }],
    commands: ['cat /skills/input.txt'],
  },
});

const result = await run.result();
```

At runtime the worker:

1. Requests a sandbox lease from `context.sandboxBroker.createSandbox(...)`.
2. Uploads `input.seedFiles` when the selected sandbox supports `uploadFiles`.
3. Executes each command in `input.commands`.
4. Emits generic worker events such as `job.accepted`, `sandbox.created`, `sandbox.stdout`, `job.completed`, or `job.failed`.
5. Releases the sandbox lease in a `finally` block.

## Input shape and behavior

The browser worker accepts a conventional object input with these recognized fields:

- `prompt?: string` for higher-level skill-creation prompts.
- `seedFiles?: Array<{ path: string; content: string | Uint8Array }>` for virtual filesystem setup before commands run.
- `commands?: string[]` for the ordered command list executed in the sandbox.
- `sshTunnel?: { ... }` for secure remote-session tunnel orchestration.

Unknown fields are ignored. Non-array `seedFiles` and `commands` values are treated as absent, and non-string commands are filtered out before execution.

## Secure SSH tunnel jobs

When `input.sshTunnel` is provided, the worker synthesizes a locked-down `ssh -N -T` command and appends it to the command list. The current contract requires:

- Safe hostname and username values.
- Integer `localPort` and `remotePort` values in the `1-65535` range.
- Absolute safe paths for `keyPath` and optional `knownHostsPath`.
- `strictHostKeyChecking: true`.

Optional `port` defaults to `22`. Optional `proxyCommand` is allowed only when it uses a restricted safe character set. Invalid tunnel input fails the job before any sandbox command executes.

## Failure modes

- If the selected sandbox does not expose `uploadFiles`, jobs with `seedFiles` fail with a diagnostic instead of silently skipping the upload.
- If any command exits non-zero, the run fails immediately and includes a diagnostic describing the exit code and command.
- If sandbox acquisition or execution throws, the worker serializes the error into the returned result.
- Cancelling the completed run surface changes the reported status to `cancelled` without replaying the job.

Run:

```bash
npm --workspace @agent-harness/worker-browser run test:coverage
```
