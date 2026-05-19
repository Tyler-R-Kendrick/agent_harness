# Scheduled Cloud Agents

- Harness: Warp
- Sourced: 2026-05-19

## What it is
Warp can schedule cloud agents and skill-based agents to run automatically, turning the harness into a recurring operations system instead of a tool that only acts when a human opens the terminal.

## Evidence
- Official docs: [Scheduled Agents](https://docs.warp.dev/agent-platform/cloud-agents/triggers/scheduled-agents)
- Official docs: [Agents Overview](https://docs.warp.dev/agents)
- First-party details:
  - scheduled runs are a documented first-party cloud-agent trigger rather than an after-market cron recipe
  - scheduling is paired with hosted environments so the task does not depend on the user's laptop being open
  - schedules can target reusable skill-based agents through the Oz web app as well as direct prompts
  - the product model is closer to durable automation with run history and inspection than to a transient chat prompt
- Latest development checkpoint:
  - Warp's current documentation treats scheduling as part of the main cloud-agent story, showing that automation is now a core product surface rather than a bolt-on

## Product signal
This keeps pressure on competing harnesses to move from reactive chat to reliable recurring execution with result delivery, packaging, and auditability.
