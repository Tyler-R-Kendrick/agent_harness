# @agent-harness/core-tool-api

Shared core API for tool registration and execution across agent-harness projects.

## Usage

```ts
import { CoreToolApi } from '@agent-harness/core-tool-api';
import type { ToolDefinition, ToolProvider } from '@agent-harness/core-tool-api';
```

## Goals

- Single registration/execution entrypoint for tool definitions.
- Standards-aligned tool definitions (`mcp`, `openapi`, `json-schema`).
- Provider abstraction that supports native and WASI-backed WASM runtimes.

## Package Boundary

Use `@agent-harness/core-tool-api` as the stable public import path. The root entry point intentionally exports `CoreToolApi` plus the tool definition, provider, runtime context, JSON value, convention, and WASI binding types.

Treat `@agent-harness/core-tool-api/src/*` deep imports as private implementation paths. They are included in the TypeScript-source package artifact for workspace consumers, but they are not stable public API entry points.

The published package is intentionally limited to `README.md`, `package.json`, and runtime `src/**/*.ts` files, excluding tests.
