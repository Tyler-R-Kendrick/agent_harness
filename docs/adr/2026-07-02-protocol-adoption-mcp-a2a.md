# ADR: Protocol Adoption — MCP Client and A2A; ACP Retired

## Status
Proposed

## Decision
Adopt MCP for agent↔tool integration in both directions and A2A for
agent↔agent coordination. Record the correction that ACP is not adopted:
IBM's ACP merged into A2A in August 2025 and its repository was archived;
both MCP and A2A are governed by the Linux Foundation Agentic AI Foundation.

## Contract
- Serving (exists, keep): WebMCP bridge — `lib/webmcp` (spec-faithful
  `navigator.modelContext` polyfill) and `lib/agent-browser-mcp`
  (`createWebMcpToolBridge`, `register*Tools`).
- Consuming (new): an MCP client that mounts external MCP servers' tools
  into the AI SDK `ToolSet` via the existing tool-composition seam
  (`agent-browser/src/tools/index.ts` `ToolDescriptor`/`ToolGroup` registry).
  This fulfills the integration model already documented in
  `agent-browser/src/services/agentRunner.ts`.
- A2A (new): an A2A router that exposes chat agents as A2A endpoints and
  composes `runToolAgent` chains across agents; agent cards derive from the
  sub-harness descriptor (`2026-07-02-meta-harness-runtime.md`).
- Channel and identity concerns stay in the plugin layer
  (`docs/plugin-standards.md` channel contributions); agent auth follows
  auth.md adoption (`docs/architecture/standards-adoption.md`).

## Rollout phases
1. **Phase 0 (shadow):** MCP client behind a dev flag; tool invocations
   logged, results not consumed in product flows.
2. **Phase 1 (opt-in):** MCP client tools mountable per workspace; A2A
   endpoint opt-in per agent.
3. **Phase 2 (core-default):** MCP client is the default external-tool
   mechanism; A2A is the default cross-agent coordination protocol.

## Migration notes
- No existing WebMCP surface changes; client and server sides share tool
  identity via `toWebMcpToolId`.
- Serena (LSP semantic code retrieval) is the first candidate default MCP
  client connection once Phase 1 lands.
