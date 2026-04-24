# @agent-harness/agent-browser-mcp

MCP tool, resource, prompt, and prompt-template definitions for Agent Browser.

## Public Entry Point

Consumers should import from the package root:

```ts
import { createWebMcpToolBridge, registerWorkspaceTools } from '@agent-harness/agent-browser-mcp';
```

This package depends on `@agent-harness/webmcp` through its package entry point. Do not import `../webmcp/src/*` from this package; WebMCP internals are owned by `@agent-harness/webmcp`.

## Local Development

Run package checks from this directory:

```sh
npm run test
npm run test:coverage
```
