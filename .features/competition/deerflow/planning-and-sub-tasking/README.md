# Planning And Sub-Tasking

- Harness: DeerFlow
- Sourced: 2026-06-04

## What it is
DeerFlow plans ahead, decomposes complex work, and spawns scoped subagents that can execute in parallel across built-in workers, custom DeerFlow agents, or external ACP-wrapped coding agents.

## Evidence
- DeerFlow docs: [Subagents](https://deerflow.tech/en/docs/harness/subagents)
- First-party details:
  - DeerFlow ships built-in `general-purpose` and `bash` subagents, each with their own timeout and max-turn controls
  - the Lead Agent delegates through the `task` tool, and `max_concurrent_subagents` caps how many parallel subagents can launch in one turn
  - subagents run with isolated context so they only see the task-specific working set they need
  - external agents can join through the Agent Connect Protocol, with first-party examples for Claude Code and Codex ACP adapters
  - custom agents created in the DeerFlow App can also be invoked as subagents, which turns UI-defined specialists into reusable workers

## Product signal
DeerFlow treats decomposition as an explicit runtime topology that operators can tune across built-in, app-defined, and third-party agent workers.
