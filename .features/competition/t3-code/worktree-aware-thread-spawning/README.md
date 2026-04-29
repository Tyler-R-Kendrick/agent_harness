# Worktree-Aware Thread Spawning

- Harness: T3 Code
- Sourced: 2026-04-29

## What it is
T3 Code keeps branch and worktree state attached to threads, and it exposes shortcuts for creating new chats that either preserve the current branch/worktree state or start a new local environment.

## Evidence
- Keybindings doc: [KEYBINDINGS.md](https://raw.githubusercontent.com/pingdotgg/t3code/main/KEYBINDINGS.md)
- GitHub Releases: [T3 Code releases](https://github.com/pingdotgg/t3code/releases)
- First-party details:
  - `chat.new` creates a new chat thread while preserving the active thread's branch/worktree state
  - `chat.newLocal` creates a new chat thread for the active project in a new environment
  - the 2026-04-17 `v0.0.19` release calls out fixes for "worktree base branch updates for active draft"
  - the 2026-04-15 nightly notes include "Fix new-thread draft reuse for worktree defaults" and "Refresh git status after branch rename and worktree setup"

## Product signal
This is a strong sign that T3 Code is optimizing around isolated parallel coding contexts rather than a single mutable session.
