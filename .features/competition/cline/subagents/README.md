# Subagents

- Harness: Cline
- Sourced: 2026-04-30

## What it is
Cline can launch focused read-only subagents in parallel to research different parts of a codebase without bloating the main session.

## Evidence
- Official docs: [Subagents](https://docs.cline.bot/features/subagents)
- First-party details:
  - the docs say subagents run parallel research against the codebase without filling the main context window
  - each subagent gets its own prompt, context window, and token budget
  - subagents can read files, search code, list directories, run read-only commands, and use skills
  - subagents return reports with the most relevant file paths for the main agent to inspect next
  - subagent usage is surfaced in the UI with per-subagent tool, token, and cost stats
- Latest development checkpoint:
  - the official `v3.79.0` release dated April 16, 2026 added `use_subagents` to more provider prompts

## Product signal
Cline is making bounded parallel research a mainstream coding workflow, which overlaps directly with agent-browser needs around parallel codebase discovery and task decomposition.
