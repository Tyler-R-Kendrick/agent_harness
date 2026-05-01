# MCP Client, Server, And Tool Approval

- Harness: Mastra
- Sourced: 2026-05-01

## What it is
Mastra treats MCP as a two-way integration surface: agents can consume external MCP servers through `MCPClient`, and Mastra can also expose its own tools, prompts, agents, workflows, and resources through `MCPServer`.

## Evidence
- Official docs: [MCP Overview](https://mastra.ai/docs/mcp/overview)
- First-party details:
  - Mastra documents two MCP classes: `MCPClient` for connecting to external servers and `MCPServer` for exposing Mastra primitives to other MCP clients.
  - Agents can load MCP tools directly from configured servers through `.listTools()`.
  - Mastra supports human approval for MCP tool execution through `requireToolApproval`, including dynamic per-call decisions.
  - The docs also cover registry-backed MCP discovery for providers like Klavis AI, `mcp.run`, Composio, Smithery, and Ampersand.
- Latest development checkpoint:
  - the current docs present MCP as a broad interoperability layer with auth, approval, and registry discovery rather than as a narrow single-server example

## Product signal
Mastra is leaning into MCP as both ingestion and export infrastructure. That is a strong sign that future harnesses will compete on how safely and flexibly they can sit inside a wider tool ecosystem, not only on their core prompt UX.
