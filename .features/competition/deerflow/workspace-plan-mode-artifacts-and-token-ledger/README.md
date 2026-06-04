# Workspace Plan Mode, Artifacts, And Token Ledger

- Harness: DeerFlow
- Sourced: 2026-06-04

## What it is
DeerFlow ships a browser workspace where the operator can turn on plan mode, watch the agent maintain a live task list, inspect tool and subagent activity, review generated artifacts, and compare thread-level token totals with visible per-turn usage.

## Evidence
- DeerFlow docs: [Workspace Usage](https://deerflow.tech/en/docs/application/workspace-usage)
- DeerFlow backend notes: [backend/CLAUDE.md](https://github.com/bytedance/deer-flow/blob/main/backend/CLAUDE.md)
- First-party details:
  - Plan Mode in the input bar enables the todo-list middleware and shows `pending`, `in_progress`, and `completed` task states in real time
  - the workspace exposes per-thread artifacts with previews and download links rather than leaving outputs buried in the filesystem
  - tool calls, tool results, thinking blocks, and subagent output are visible inline in the conversation stream
  - the UI distinguishes a persisted conversation-level token total from optional per-turn or debug usage summaries
  - runtime config exposes `is_plan_mode` and a `write_todos` tool so the plan list is a first-class execution contract, not just a UI checklist

## Product signal
DeerFlow treats long-running execution as something users supervise through a visible plan and evidence surface instead of a black-box transcript.
