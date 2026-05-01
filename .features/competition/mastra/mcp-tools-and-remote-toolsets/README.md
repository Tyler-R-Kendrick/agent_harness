# Mcp Tools And Remote Toolsets

- Harness: Mastra
- Sourced: 2026-05-01

## What it is
Mastra makes MCP a native capability for both consuming remote tools and exposing agents, tools, and resources outward, including dynamic per-user toolsets when connectivity or credentials vary.

## Evidence
- Official repo: [mastra-ai/mastra README](https://github.com/mastra-ai/mastra)
- Official docs: [Using Tools](https://mastra.ai/docs/agents/using-tools)
- Official docs: [MCP overview](https://mastra.ai/docs/mcp/overview)
- Official releases: [mastra-ai/mastra releases](https://github.com/mastra-ai/mastra/releases)
- First-party details:
  - the README says Mastra can author MCP servers that expose agents, tools, and structured resources
  - the tool docs say agents can load tools from remote MCP servers to expand their capabilities
  - the MCP overview docs describe `.listToolsets()` for request-specific or user-specific tool configuration in multi-tenant systems
  - the March 12, 2026 release notes added a dedicated `MCP_TOOL_CALL` span type plus MCP-specific trace styling in Studio
- Latest development checkpoint:
  - the current docs and release notes show MCP is wired into both execution and observability, which suggests Mastra sees it as infrastructure rather than a one-off integration layer

## Product signal
Mastra treats MCP as an operational substrate for agent capability routing, not just an optional plugin bridge.
