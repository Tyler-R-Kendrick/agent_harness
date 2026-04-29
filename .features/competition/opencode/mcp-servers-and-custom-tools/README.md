# MCP Servers And Custom Tools

- Harness: OpenCode
- Sourced: 2026-04-27

## What it is
OpenCode can load remote or local MCP servers alongside custom tools, making external tool access part of normal agent execution.

## Evidence
- Official docs: [MCP servers](https://opencode.ai/docs/mcp-servers)
- Official docs: [Tools](https://opencode.ai/docs/tools/)
- First-party details:
  - OpenCode supports both local and remote MCP servers
  - MCP tools become available beside built-in tools
  - tools and MCP access can be enabled or disabled globally or per agent
  - the docs explicitly frame MCP as the way to connect external tools and services

## Product signal
OpenCode is treating external actionability as core harness infrastructure, not as a niche plugin escape hatch.
