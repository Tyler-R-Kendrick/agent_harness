# Worktree-Backed Parallel Sessions

- Harness: Claude Code
- Sourced: 2026-05-22

## What it is
Claude Code documents git worktrees as the recommended isolation layer for concurrent coding sessions, giving each agent a separate branch and working copy.

## Evidence
- Docs: [Git worktrees](https://code.claude.com/docs/en/git-worktrees)
- The docs describe worktrees as a way to:
  - run multiple Claude Code tasks in parallel without branch conflicts
  - isolate experimental or review work from the main checkout
  - keep each session tied to its own branch and filesystem state

## Product signal
Parallelism is not only a prompt or subagent concept here; Anthropic is standardizing repo isolation as part of the runtime model.
