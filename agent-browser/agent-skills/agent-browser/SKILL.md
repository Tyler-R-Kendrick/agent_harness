---
name: agent-browser
description: "Operating guide for the agent-browser workspace shell. Use this whenever the user asks how to inspect, navigate, or modify the active agent-browser workspace, Files surface, browser pages, sessions, clipboard history, render panes, or WebMCP tool flows. Prefer it before improvising tool chains because the active workspace, workspace files, and mounted session drives have specific semantics in this project."
license: MIT
metadata:
  version: "1.1.0"
---

# Agent Browser

Use this skill when working inside the live `agent-browser` runtime.

## Steps

1. Start from the active workspace and inspect its render panes or worktree items before scanning broadly.
2. Prefer workspace files under `//workspace` before mounted session filesystems when the task touches durable instructions, skills, plugins, or hooks.
3. Inspect sessions only when the task depends on chat state, terminal state, or runtime artifacts.
4. Use the deterministic workflow map in `scripts/resolve-workflow.ts` when the task matches one of the common operation chains.

## Rules

- The registered WebMCP tools only see the active workspace.
- Use the repository's product language: workspace, page overlay, chat panel, terminal mode, workspace files, and clipboard history.
- When runtime code should reference a durable workspace file, symlink the workspace file into the session filesystem instead of duplicating content.

## References

- Read [references/tool-map.md](references/tool-map.md) for the full feature-to-tool map.
- Read [references/workflow-recipes.md](references/workflow-recipes.md) for the common operation chains and path priorities.

## Deterministic workflow

`scripts/resolve-workflow.ts` defines the canonical tool sequences for common `agent-browser` tasks such as inspecting the workspace, editing a default skill, inspecting runtime output, and linking durable files into a session filesystem.