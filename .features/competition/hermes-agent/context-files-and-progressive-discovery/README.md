# Context Files And Progressive Discovery

- Harness: Hermes Agent
- Sourced: 2026-05-15

## What it is
Hermes loads repo instruction files such as `AGENTS.md`, `.hermes.md`, `CLAUDE.md`, and Cursor rules with explicit precedence, then progressively discovers deeper subdirectory context only when the agent starts touching those paths.

## Evidence
- Official docs: [Context Files](https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files)
- Official docs: [Features Overview](https://hermes-agent.nousresearch.com/docs/user-guide/features/overview/)
- First-party details:
  - Hermes supports `.hermes.md`, `AGENTS.md`, `CLAUDE.md`, `SOUL.md`, `.cursorrules`, and `.cursor/rules/*.mdc`
  - only one project context type loads at session start, with explicit precedence from `.hermes.md` to `AGENTS.md` to `CLAUDE.md` to `.cursorrules`
  - subdirectory instruction files are discovered progressively as the agent reads files in those areas
  - the docs present this as a way to avoid prompt bloat while still preserving repo-local behavior shaping
- Latest development checkpoint:
  - the current docs keep progressive subdirectory discovery as the default context-loading strategy, which makes repo-owned instructions an intentional runtime surface rather than an accidental prompt artifact

## Product signal
Hermes is making context-file discovery predictable and prompt-budget-aware, which is directly relevant to harnesses that need repo conventions without stuffing every possible instruction into turn zero.
