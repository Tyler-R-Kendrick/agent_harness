# Agent Manager, Worktrees, And Multi-Version Sessions

- Harness: Kilo Code
- Sourced: 2026-05-07

## What it is
Kilo Code ships a first-class Agent Manager that turns parallel, worktree-isolated coding sessions into an editor-native control panel instead of an ad hoc pile of terminals and branches.

## Evidence
- Official docs: [Agent Manager](https://kilo.ai/docs/automate/agent-manager)
- Official docs: [Automate overview](https://kilo.ai/docs/automate)
- Official releases: [Kilo releases](https://github.com/Kilo-Org/kilocode/releases)
- First-party details:
  - the Agent Manager docs say each parallel session runs in its own git worktree and branch
  - Kilo includes a live diff and review panel, dedicated integrated terminals per session, setup scripts, root `.env` copying, and PR status badges
  - the docs say Kilo can run up to four parallel implementations of the same prompt through Multi-Version Mode
  - sessions can be imported from existing branches, external worktrees, GitHub PR URLs, or promoted from the sidebar through "Continue in Worktree"
  - the May 6, 2026 pre-release notes add recovery for Agent Manager worktrees after restart when saved state is missing, corrupt, or stale
- Official visual:
  - the docs position Agent Manager as a full-panel editor tab rather than a sidebar-only control surface
- Latest development checkpoint:
  - the early May 2026 releases are still improving Agent Manager durability, which signals that Kilo sees multi-session orchestration as a core surface, not a side feature

## Product signal
Kilo is productizing worktree-native parallelism with enough review, terminal, and persistence affordances that multi-agent coding starts to look like a workspace operating system rather than a chat add-on.