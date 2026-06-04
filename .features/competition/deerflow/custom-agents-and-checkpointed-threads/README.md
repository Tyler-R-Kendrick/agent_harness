# Custom Agents And Checkpointed Threads

- Harness: DeerFlow
- Sourced: 2026-06-04

## What it is
DeerFlow lets operators define named custom agents with scoped models, skills, tools, and prompts, then run them inside persistent threads whose artifacts and working files survive restarts through checkpointing.

## Evidence
- DeerFlow docs: [Agents and Threads](https://deerflow.tech/en/docs/application/agents-and-threads)
- First-party details:
  - custom agents can each set a default model, restricted skills, restricted tool groups, and agent-specific instructions
  - agents can be created in the App UI or through `POST /api/agents`, with config stored in `agents/{name}/config.yaml`
  - each thread keeps its own message history, artifacts, title, and selected agent reference
  - DeerFlow supports in-memory, SQLite, and PostgreSQL checkpointers so thread state can survive restarts
  - thread uploads, intermediate files, and outputs live under `backend/.deer-flow/threads/{thread_id}/user-data/` and are mounted into the sandbox as `/mnt/user-data/`

## Product signal
DeerFlow treats agent variants and resumable task state as an operating model, not just a prompt tweak or chat-history convenience.
