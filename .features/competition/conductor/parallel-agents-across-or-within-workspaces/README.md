# Parallel Agents Across Or Within Workspaces

- Harness: Conductor
- Sourced: 2026-05-12

## What it is
Conductor can split work across multiple agents either in separate workspaces or together inside one workspace, giving operators a choice between branch isolation and same-branch collaboration.

## Evidence
- Official docs: [Parallel agents](https://www.conductor.build/docs/concepts/parallel-agents)
- Official docs: [Workspaces and branches](https://www.conductor.build/docs/concepts/workspaces-and-branches)
- First-party details:
  - Conductor supports multiple agents working on the same overall task at once
  - users can choose separate workspaces for safer isolation or one shared workspace for tighter collaboration
  - the product explicitly distinguishes between multi-workspace and same-workspace parallelism
- Latest development checkpoint:
  - the current docs present parallel agents as a core workflow, not a side experiment or hidden flag

## Product signal
Conductor is pushing orchestration beyond "spawn helpers" into explicit topology choices, which is useful for harnesses that need to balance merge safety against coordination speed.
