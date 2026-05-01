# Scheduled Cloud Agents

- Harness: Warp
- Sourced: 2026-04-30

## What it is
Warp can schedule Cloud Agents to run automatically, turning the harness into a recurring operations system instead of a tool that only acts when a human opens the terminal.

## Evidence
- Official docs: [Scheduled Agents](https://docs.warp.dev/agent-platform/cloud-agents-and-orchestration/triggers/scheduled-agents)
- Official docs: [Agents Overview](https://docs.warp.dev/agents)
- First-party details:
  - scheduled runs are a documented first-party Cloud Agent feature
  - scheduling is paired with hosted environments so the task does not depend on the user's laptop being open
  - the product model is closer to durable automation than to a transient chat prompt
  - this gives Warp a direct answer to recurring maintenance, triage, and reporting workflows
- Latest development checkpoint:
  - Warp's current documentation treats scheduling as part of the main Cloud Agent story, showing that automation is now a core product surface

## Product signal
This keeps pressure on competing harnesses to move from reactive chat to reliable recurring execution with result delivery and auditability.
