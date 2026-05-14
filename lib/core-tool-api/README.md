# @agent-harness/core-tool-api

Shared core API for tool registration and execution across agent-harness projects.

## Goals

- Single registration/execution entrypoint for tool definitions.
- Standards-aligned tool definitions (`mcp`, `openapi`, `json-schema`).
- Provider abstraction that supports native and WASI-backed WASM runtimes.
