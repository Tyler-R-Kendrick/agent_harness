# Gemini Md Layered Context And Imports

- Harness: Gemini CLI
- Sourced: 2026-05-04

## What it is
Gemini CLI uses `GEMINI.md` as a repo-owned context contract with hierarchical discovery and `@import` support, so teams can version durable instructions alongside the codebase and split them into maintainable layers.

## Evidence
- Official docs: [GEMINI.md Files](https://geminicli.com/docs/cli/gemini-md/)
- First-party details:
  - Gemini CLI looks for `GEMINI.md` files across scopes and merges them into runtime context.
  - The docs support `@import` so teams can compose shared instructions instead of maintaining one giant file.
  - The file is positioned as an explicit instruction surface for projects, not as an opaque system-prompt side channel.
- Latest development checkpoint:
  - layered `GEMINI.md` composition is part of the current docs set and remains a central context-management surface in May 2026.

## Product signal
Gemini CLI is reinforcing the pattern that agent behavior should live in versioned workspace contracts. The importable hierarchy also shows pressure toward maintainable instruction systems rather than single-file prompt sprawl.
