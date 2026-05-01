# Multitask Worktrees And Multi Root Workspaces

- Harness: Cursor
- Sourced: 2026-05-01

## What it is
Cursor can now break larger requests into async subagents, run those agents across isolated worktrees, and target multi-root workspaces so one session can safely span several repositories.

## Evidence
- Official changelog: [Multitask, Worktrees, and Multi-root Workspaces](https://cursor.com/changelog)
- Official product page: [Cursor product overview](https://cursor.com/product)
- First-party details:
  - the April 24, 2026 release introduces `/multitask`, which runs async subagents in parallel instead of merely queueing follow-up work
  - the same release says worktrees in the Agents Window let users run isolated background tasks across different branches and then move a branch into the foreground with one click
  - Cursor also says a single agent session can target a reusable workspace made of multiple folders so the agent can make cross-repo changes without retargeting
  - the product page reinforces that subagents run in parallel and may use different models for different pieces of the job
- Latest development checkpoint:
  - the April 24, 2026 release is a clear escalation from single-run chat toward a supervisor model for branch-isolated parallel execution

## Product signal
Cursor is turning parallel agent execution into an opinionated workflow primitive, especially for multi-branch and multi-repo coding tasks where isolation and compareability matter.
