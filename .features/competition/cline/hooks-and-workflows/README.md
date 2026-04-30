# Hooks And Workflows

- Harness: Cline
- Sourced: 2026-04-30

## What it is
Cline exposes both markdown workflows for repeatable procedures and programmable hooks for enforcement, validation, and context injection.

## Evidence
- Official docs: [Workflows](https://docs.cline.bot/customization/workflows)
- Official docs: [Hooks](https://docs.cline.bot/customization/hooks)
- First-party details:
  - workflows are markdown files invoked as slash commands for repetitive multi-step tasks
  - workflows can combine natural-language instructions with Cline tools, CLI tools, and MCP tools
  - hooks run automatically at lifecycle points such as `TaskStart`, `TaskResume`, `PreToolUse`, and `PostToolUse`
  - hook examples include checking prerequisites, adding context, notifying external systems, and blocking invalid operations

## Product signal
This is a strong sign that vendors are converging on a two-layer automation model: reusable user-authored procedures plus hard guardrails that can deterministically shape agent behavior.
