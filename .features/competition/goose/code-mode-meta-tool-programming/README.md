# Code Mode Meta-Tool Programming

- Harness: Goose
- Sourced: 2026-05-03

## What it is
Goose Code Mode is a built-in MCP extension that lets the model write JavaScript to discover tools, inspect schemas, and execute tool workflows programmatically instead of only issuing one tool call at a time.

## Evidence
- Official docs: [Code Mode Extension](https://goose-docs.ai/docs/mcp/code-mode-mcp)
- Official blog: [Code Mode Doesn't Replace MCP](https://goose-docs.ai/blog/2025/12/21/code-mode-doesnt-replace-mcp/)
- First-party details:
  - Goose says Code Mode exposes three meta-tools and runs JavaScript in a Deno-based runtime called Port of Context.
  - The goal is to manage context more efficiently when many extensions are enabled and a task needs many tool calls.
  - Goose positions Code Mode as a programmatic approach to MCP interaction rather than a replacement for MCP itself.
  - Release notes for `v1.17.0` introduced Code Mode MCP as a first-class platform extension.
- Latest development checkpoint:
  - the current docs present Code Mode as a stable part of the built-in platform extension set, not a research preview

## Product signal
Goose is leaning into meta-tooling: instead of only improving tool schemas, it gives the agent a programmable layer for orchestrating tools with less prompt-window waste.
