# Orchestrator Boomerang Subtasks

- Harness: Roo Code
- Sourced: 2026-05-09

## What it is
Roo ships a built-in Orchestrator mode that breaks complex work into subtasks and delegates each subtask to a more specialized mode or cloud worker.

## Evidence
- Official docs: [Boomerang Tasks](https://docs.roocode.com/features/boomerang-tasks)
- Official docs: [Cloud Agents](https://docs.roocode.com/roo-code-cloud/cloud-agents)
- First-party details:
  - Boomerang Tasks let Roo break large projects into smaller, focused subtasks
  - the `Orchestrator` mode is now built in rather than requiring a custom boomerang mode
  - subtasks can be delegated to specialized modes such as Code, Architect, or Debug
  - Roo Cloud separately frames cloud agents as a focused team that can plan, code, review, and fix work autonomously
- Latest development checkpoint:
  - Roo's current docs present orchestration as a first-class built-in mode rather than an advanced user hack, which shows the product moving from single-thread chat toward managed delegation by default

## Product signal
Roo wants users to think in terms of coordinated specialists, with explicit task decomposition inside the IDE and a parallel autonomous team in the cloud.
