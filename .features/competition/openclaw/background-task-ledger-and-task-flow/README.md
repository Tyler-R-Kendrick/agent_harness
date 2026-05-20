# Background Task Ledger And Task Flow

- Harness: OpenClaw
- Sourced: 2026-05-20

## What it is
OpenClaw tracks detached work as durable task records with lifecycle state, requester linkage, and delivery rules instead of treating background runs as opaque side effects.

## Evidence
- Official docs: [Background tasks](https://docs.openclaw.ai/automation/tasks)
- First-party details:
  - ACP runs, subagent spawns, isolated cron executions, and CLI agent commands all create task records
  - tasks move through `queued -> running -> terminal`, with explicit terminal states like `succeeded`, `failed`, `timed_out`, `cancelled`, or `lost`
  - task records can reference both the child session where work ran and the requester session that initiated it
  - task completion is push-driven: detached work can notify directly or wake the requester session or heartbeat when it finishes
  - `openclaw tasks` inspects individual task records while `openclaw tasks flow` inspects the higher-level orchestration flow above them
- Latest development checkpoint:
  - the current task docs frame the ledger as a core operations primitive for detached work, not just a debugging add-on

## Product signal
OpenClaw is operationalizing background execution. The interesting move is not just “run later,” but “keep a durable activity ledger that the operator and requesting session can both reason about.”
