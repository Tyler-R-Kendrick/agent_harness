# Isolated Workspaces Per Task, Branch, And Runtime

- Harness: Conductor
- Sourced: 2026-05-12

## What it is
Conductor treats each task as its own working environment, with a dedicated git branch, working tree, logs, and terminal session instead of collapsing all work into one shared chat workspace.

## Evidence
- Official docs: [Workspaces and branches](https://www.conductor.build/docs/concepts/workspaces-and-branches)
- Official docs: [Issue to PR](https://www.conductor.build/docs/guides/issue-to-pr)
- First-party details:
  - every workspace maps to a dedicated git branch and its own runtime
  - users can create workspaces from issues or prompts and then archive them after merge
  - Conductor explicitly frames workspaces as the unit for context, execution, and review
- Latest development checkpoint:
  - the current docs emphasize branch-native, per-task isolation as the default working model rather than an advanced option

## Product signal
This is a strong sign that serious coding harnesses are converging on task-isolated workspaces as the base primitive for reliable parallel work and reviewable delivery.
