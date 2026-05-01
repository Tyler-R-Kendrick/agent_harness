# Context Files And System Prompt Layering

- Harness: Pi
- Sourced: 2026-04-30

## What it is
Pi automatically loads layered project guidance from `AGENTS.md` or `CLAUDE.md`, supports project and global system-prompt overrides, and now also lets users disable automatic context-file discovery when they need a clean run.

## Evidence
- Official coding-agent README: [packages/coding-agent/README.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md)
- Official releases page: [badlogic/pi-mono releases](https://github.com/badlogic/pi-mono/releases)
- First-party details:
  - the README says Pi concatenates matching `AGENTS.md` or `CLAUDE.md` files from the global scope, parent directories, and the current directory
  - `.pi/SYSTEM.md` and `APPEND_SYSTEM.md` allow project-scoped prompt replacement or append behavior
  - the releases page documents `--no-context-files` and `-nc` as a recent addition for disabling automatic project-context loading
- Latest development checkpoint:
  - recent release notes also expose the same context-file resolution behavior to extensions and SDK consumers, which suggests Pi is standardizing this contract across interactive and embedded usage

## Product signal
Pi is treating repo-owned instructions as a stable runtime contract, while still giving operators a clean-room escape hatch when inherited context is undesirable.
