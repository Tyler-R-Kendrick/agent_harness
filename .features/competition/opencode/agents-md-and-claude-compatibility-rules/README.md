# AGENTS.md And Claude Compatibility Rules

- Harness: OpenCode
- Sourced: 2026-04-27

## What it is
OpenCode reads project and global instruction files and also supports Claude-style compatibility fallbacks for teams migrating from other coding agents.

## Evidence
- Official docs: [Rules](https://opencode.ai/docs/rules/)
- First-party details:
  - project rules can live in a repo-level `AGENTS.md`
  - global personal rules can live in `~/.config/opencode/AGENTS.md`
  - if no `AGENTS.md` exists, OpenCode can fall back to `CLAUDE.md`
  - Claude-compatible skill directories under `~/.claude/skills/` are also supported

## Product signal
OpenCode is competing on migration friendliness and instruction portability, reducing switching cost for teams that already invested in agent rules elsewhere.
