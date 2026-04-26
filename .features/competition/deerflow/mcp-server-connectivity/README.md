# MCP Server Connectivity

- Harness: DeerFlow
- Sourced: 2026-04-26

## What it is
DeerFlow supports configurable MCP servers as a first-class extension mechanism for tools and skills.

## Evidence
- GitHub README: [DeerFlow - 2.0](https://github.com/bytedance/deer-flow/blob/main/README.md)
- First-party details:
  - DeerFlow documents configurable MCP servers and MCP-backed skills
  - HTTP and SSE MCP servers support OAuth token flows including `client_credentials` and `refresh_token`
  - the AIO sandbox also exposes MCP as part of the packaged execution environment

## Product signal
MCP is not bolt-on compatibility here; it is part of DeerFlow's core extensibility story.
