# MCP Server Management

- Harness: Warp
- Sourced: 2026-04-30

## What it is
Warp supports Model Context Protocol servers directly, giving the agent structured access to external tools and data sources from within the terminal environment.

## Evidence
- Official docs: [Model Context Protocol (MCP)](https://docs.warp.dev/features/warp-ai/mcp)
- First-party details:
  - Warp lets users add and manage MCP servers as a built-in capability
  - MCP becomes part of the same terminal-agent surface instead of a separate experimental extension path
  - the docs frame MCP as a way to expand the agent with connected tools and live external context
  - server management is explicit, which suggests Warp expects users to operate multiple integrations rather than just one bundled assistant
- Latest development checkpoint:
  - current Warp docs keep MCP in the main AI feature area, signaling continued investment in tool connectivity

## Product signal
Warp is aligning with the broader agent-harness market shift toward MCP as the default integration contract for connected tools.
