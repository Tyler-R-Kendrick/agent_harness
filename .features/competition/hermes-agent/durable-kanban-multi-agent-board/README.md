# Durable Kanban Multi-Agent Board

- Harness: Hermes Agent
- Sourced: 2026-05-24

## What it is
Hermes ships a durable Kanban board for multi-agent work where orchestration, retries, dependencies, worker heartbeats, and dashboard supervision all share one task substrate instead of living inside ephemeral subagent transcripts.

## Evidence
- Official docs: [Kanban](https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban)
- Official docs: [Kanban tutorial](https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban-tutorial)
- Official release: [Hermes Agent v0.13.0](https://github.com/NousResearch/hermes-agent/releases)
- Official release: [Hermes Agent v0.14.0](https://github.com/NousResearch/hermes-agent/releases)
- First-party details:
  - the Kanban docs describe a shared `~/.hermes/kanban.db` board with task graphs, comments, attempts, assignees, and dedicated worker workspaces
  - workers do not shell out to `hermes kanban`; they operate through task-scoped `kanban_*` tools while humans can use the CLI, slash commands, or dashboard against the same board state
  - the dashboard plugin now exposes auto-versus-manual orchestration, triage decomposition, bulk actions, per-profile running lanes, and a side drawer for dependency editing and task control
  - the `v0.13.0` release frames Kanban as a reliability surface with heartbeat, reclaim, zombie detection, auto-block on incomplete exit, per-task retries, and hallucination recovery
- Latest development checkpoint:
  - the current May 2026 docs show Kanban becoming the main orchestration substrate for Hermes, not just a visualization layer over helper spawning

## Product signal
Hermes is turning multi-agent coordination into a recoverable task system with explicit orchestration contracts, not an in-memory prompting trick.
