# Git Worktrees For Parallel Branches

- Harness: Roo Code
- Sourced: 2026-05-09

## What it is
Roo exposes Git worktrees in-product so users can run parallel tasks on separate branches without constant branch switching.

## Evidence
- Official docs: [Worktrees](https://docs.roocode.com/features/worktrees)
- First-party details:
  - Roo positions worktrees as a way to test different implementations, review PRs, and run multiple tasks simultaneously
  - each worktree gets its own VS Code window with Roo Code attached
  - the chat interface exposes a worktree selector plus creation and management controls
  - Roo documents worktrees as especially useful for agentic coding workflows
- Latest development checkpoint:
  - Roo is not merely compatible with Git worktrees; it exposes them as a first-class coordination surface in the chat UI

## Product signal
Roo treats branch isolation as part of the harness UX, which is a stronger posture than assuming users will manage parallelism in Git on their own.
