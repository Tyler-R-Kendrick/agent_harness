# MCP Inheritance And Status-Aware Tool Connectivity

- Harness: Conductor
- Sourced: 2026-05-12

## What it is
Conductor wires MCP connectivity into the project and workspace model, including inherited configuration and explicit status visibility so users can see whether the tool layer is actually ready.

## Evidence
- Official docs: [MCP](https://www.conductor.build/docs/reference/mcp)
- Official changelog: [v0.50.0](https://www.conductor.build/changelog/0.50.0)
- Official changelog: [v0.51.0](https://www.conductor.build/changelog/0.51.0)
- First-party details:
  - Conductor documents project-level MCP configuration that applies to workspaces
  - the product exposes MCP status visibility inside the interface
  - `v0.50.0` adds `/mcp-status` for Codex and MCP-server indicators in chat messages
  - `v0.51.0` adds support for inheriting project MCP settings
- Latest development checkpoint:
  - the April 18 and April 25, 2026 releases show Conductor actively productizing MCP operational visibility, not merely offering a static config file

## Product signal
This is a strong sign that tool connectivity is maturing from "you can configure servers" into "you can inspect, inherit, and troubleshoot the tool layer as part of normal runtime operations."
