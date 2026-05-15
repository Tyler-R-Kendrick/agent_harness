# Durable Kanban Multi-Agent Board

- Harness: Hermes Agent
- Sourced: 2026-05-15

## What it is
Hermes ships a durable Kanban board for multi-agent work where tasks, dependencies, comments, retries, and worker heartbeats live in a shared board state instead of only inside ephemeral subagent conversations.

## Evidence
- Official docs: [Kanban](https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban)
- Official docs: [Kanban tutorial](https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban-tutorial)
- Official release: [Hermes Agent v0.13.0](https://github.com/NousResearch/hermes-agent/releases)
- First-party details:
  - the Kanban docs describe a shared `~/.hermes/kanban.db` board with tasks, links, comments, assignees, and worker workspaces
  - agents operate through a dedicated `kanban_*` toolset while humans can use the CLI, slash commands, or dashboard against the same board state
  - the board supports triage, todo, ready, running, blocked, done, and archived states plus profile lanes and dependency-linked promotion
  - the `v0.13.0` release frames Kanban as a durable multi-agent board with heartbeat, reclaim, zombie detection, auto-block on incomplete exit, per-task retries, and hallucination recovery
- Latest development checkpoint:
  - the May 7, 2026 `v0.13.0` release makes the board a reliability surface, not just a visualization layer for spawned helpers

## Product signal
Hermes is turning multi-agent coordination into a recoverable work-management substrate with durable state, not an in-memory orchestration trick.
