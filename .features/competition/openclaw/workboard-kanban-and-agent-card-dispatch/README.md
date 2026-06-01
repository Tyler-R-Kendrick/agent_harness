# Workboard Kanban And Agent Card Dispatch

- Harness: OpenClaw
- Sourced: 2026-06-01

## What it is
OpenClaw now ships a bundled Workboard plugin that turns the dashboard into a local agent operations board, where cards can own tasks, linked sessions, proof, and dispatchable worker runs.

## Evidence
- Official docs: [Workboard plugin](https://docs.openclaw.ai/plugins/workboard)
- Official docs: [Workboard CLI](https://docs.openclaw.ai/cli/workboard)
- Official docs: [Background tasks](https://docs.openclaw.ai/automation/tasks)
- First-party details:
  - Workboard adds an optional Kanban-style board inside the Control UI and is explicitly positioned as a local gateway work surface rather than a replacement for GitHub or Linear
  - cards store status, priority, labels, optional agent assignment, linked task or run or session or source URL, and compact proof or artifact metadata
  - cards can directly start task-backed Codex or Claude work, or open linked manual sessions without sending the card prompt yet
  - the dashboard syncs card lifecycle against the Gateway task ledger so queued, running, failed, timed out, blocked, and review states stay visible on the board
  - Workboard exposes agent tools such as `workboard_claim`, `workboard_complete`, `workboard_block`, `workboard_decompose`, and `workboard_dispatch` so worker agents can coordinate through durable board state
  - dispatch uses the Gateway subagent runtime instead of raw OS processes, which keeps card execution inside the normal OpenClaw session and task model
  - the same board can be driven from the browser dashboard, `openclaw workboard ...`, or `/workboard ...` slash commands
- Latest development checkpoint:
  - the late-May 2026 docs show Workboard growing from a simple local board into a card-backed execution layer with dependency promotion, dispatch selection, proof tracking, and deterministic worker session keys

## Product signal
OpenClaw is productizing operator-side task routing inside the harness itself. The important move is not generic Kanban; it is a board where cards, agent runs, proofs, and background tasks are the same object graph.
