# @agent-harness/core-tool-api

`@agent-harness/core-tool-api` is the minimal shared contract for registering tools, selecting an execution provider, and invoking tools with a consistent runtime context. Use it when a package needs a stable tool catalog before deciding whether execution happens natively or through a WASI-backed runtime.

## Public API

```ts
import { CoreToolApi } from '@agent-harness/core-tool-api';
import type {
  JsonValue,
  ToolDefinition,
  ToolProvider,
  ToolRuntimeContext,
  WasiToolProvider,
} from '@agent-harness/core-tool-api';
```

The root entry point exports:

- `CoreToolApi` for tool and provider registration plus execution.
- `ToolDefinition` and `ToolConvention` for the public tool contract.
- `ToolProvider`, `WasiToolProvider`, and `WasiBindings` for provider selection.
- `ToolRuntimeContext` and `JsonValue` for portable invocation payloads.

## Minimal flow

```ts
import { CoreToolApi } from '@agent-harness/core-tool-api';
import type { ToolDefinition, ToolProvider } from '@agent-harness/core-tool-api';

const api = new CoreToolApi();

const echoTool: ToolDefinition = {
  name: 'echo',
  title: 'Echo',
  description: 'Returns the input unchanged.',
  convention: 'json-schema',
  inputSchema: { type: 'object' },
  execute: async (input) => input,
};

const nativeProvider: ToolProvider = {
  id: 'native',
  kind: 'native',
  supports: (tool) => tool.name === 'echo',
  invoke: (tool, input, context) => tool.execute(input, context),
};

api.registerTool(echoTool);
api.registerProvider(nativeProvider);

const result = await api.execute('echo', { message: 'hello' }, {
  requestId: 'req-1',
  project: 'agent-harness',
  capabilities: ['fs.read'],
});
```

## Execution contract

- `registerTool()` rejects blank names and duplicate tool registrations.
- `registerProvider()` rejects blank provider IDs and duplicate provider registrations.
- `listToolNames()` returns the registered tool names in sorted order.
- `execute()` fails fast for unknown tools and for tools that have no supporting provider.
- Provider selection is capability-based: `CoreToolApi` picks the first registered provider whose `supports(tool)` returns `true`.

## Runtime context and provider shapes

`ToolRuntimeContext` carries the stable per-invocation metadata exposed by the package today:

- `requestId` for trace or audit correlation.
- `project` for workspace or tenant routing.
- `capabilities` for caller-granted permissions or environment hints.

Providers expose one of two execution kinds:

- `native` for direct in-process execution.
- `wasi-wasm` for runtimes that need explicit WASI bindings via `WasiToolProvider.wasi`.

## Package Metadata

- License: MIT
- Source: https://github.com/Tyler-R-Kendrick/agent_harness/tree/main/lib/core-tool-api

## Package Boundary

Use `@agent-harness/core-tool-api` as the stable public import path. The root entry point intentionally exports `CoreToolApi` plus the tool definition, provider, runtime context, JSON value, convention, and WASI binding types.

Treat `@agent-harness/core-tool-api/src/*` deep imports as private implementation paths. They are included in the TypeScript-source package artifact for workspace consumers, but they are not stable public API entry points.

The published package is intentionally limited to `README.md`, `package.json`, and runtime `src/**/*.ts` files, excluding tests.

## Validation

Run:

```powershell
npm.cmd --workspace @agent-harness/core-tool-api run test:coverage
```

The package test suite covers the registration guards, provider selection behavior, root export boundary, and published package metadata.
