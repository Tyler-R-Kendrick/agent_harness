# MCP Marketplace And Custom Server Transports

- Harness: Devin
- Sourced: 2026-05-02

## What it is
Devin exposes an MCP layer with a marketplace plus multiple server-connection options so external tools can be installed, managed, and reached through more than one deployment pattern.

## Evidence
- Official docs: [MCP Overview](https://docs.devin.ai/product-guides/mcp/overview)
- Official docs: [Remote MCP Servers](https://docs.devin.ai/product-guides/mcp/remote-mcp-servers)
- Official release notes: [Devin Release Notes 2026](https://docs.devin.ai/release-notes/2026)
- First-party details:
  - the docs present MCP as a first-class integration surface inside Devin
  - the April 7, 2026 release added an MCP marketplace, which shifts integrations from manual setup toward discovery and install UX
  - the April 18, 2026 release added custom transports for remote MCP servers, which matters for real enterprise network topologies
- Latest development checkpoint:
  - Devin's 2026 releases show the product moving from bare protocol support toward packaged connectivity and deployment flexibility

## Product signal
Tool connectivity is no longer enough by itself; teams want installability, policy, and network-shape flexibility around the protocol surface.
