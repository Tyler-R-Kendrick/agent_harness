# Git Worktrees And Parallel Sessions

- Harness: Cline
- Sourced: 2026-04-30

## What it is
Cline has a first-class worktree workflow for running multiple branch-isolated sessions in parallel across editor windows or CLI invocations.

## Evidence
- Official docs: [Worktrees](https://docs.cline.bot/features/worktrees)
- First-party details:
  - worktrees are described as a way to work on multiple branches simultaneously in separate folders
  - the home screen includes a `New Worktree Window` quick-launch flow
  - opening worktrees in new windows is recommended for parallel Cline sessions
  - the CLI docs show parallel worktree execution via `cline --cwd ... -y ...`
  - `.worktreeinclude` can automatically copy ignored setup files into new worktrees

## Product signal
This takes branch isolation out of advanced Git folklore and turns it into a visible agent-orchestration primitive, which is highly relevant to branch-native browser-agent workflows.
