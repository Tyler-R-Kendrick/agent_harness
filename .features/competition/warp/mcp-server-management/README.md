# MCP Server Management

- Harness: Warp
- Sourced: 2026-05-19

## What it is
Warp gives local and cloud agents first-class MCP connectivity, with built-in server management in the app and CLI support for UUID, JSON, or file-based server specs.

## Evidence
- Official docs: [Model Context Protocol (MCP)](https://docs.warp.dev/agent-platform/agent-context/model-context-protocol/)
- Official docs: [MCP servers reference](https://docs.warp.dev/reference/cli/mcp-servers)
- First-party details:
  - Warp exposes MCP server setup inside Settings and Warp Drive instead of burying it in an unsupported plugin path
  - CLI runs can attach one or more MCP servers by shared UUID, inline JSON, or file path
  - Warp syncs server configuration across logged-in machines while keeping environment variables separate so secrets still need explicit remote setup
  - the docs cover local desktop usage and a distinct cloud-agent MCP path, which makes MCP part of the supported execution model rather than a local-only hack
- Latest development checkpoint:
  - current Warp docs keep MCP in both the core agent-capability and cloud-agent reference surfaces, signaling continued investment in tool connectivity and operational portability

## Product signal
Warp is aligning with the broader agent-harness market shift toward MCP as the default integration contract for connected tools, with stronger built-in management than many terminal-first peers.
