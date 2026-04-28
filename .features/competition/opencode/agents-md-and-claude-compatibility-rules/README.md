# AGENTS.md And Claude Compatibility Rules

- Harness: OpenCode
- Sourced: 2026-04-28

## What it is
OpenCode uses `AGENTS.md` for project instructions and explicitly documents compatibility with Claude Code-style rules.

## Evidence
- Official docs: [Rules](https://opencode.ai/docs/rules/)
- First-party details:
  - the docs say users can provide custom instructions by creating an `AGENTS.md` file
  - rule types include `Project`, `Global`, and `Claude Code Compatibility`
  - the docs also describe referencing external files through `opencode.json` or manual instructions in `AGENTS.md`

## Product signal
Instruction portability is becoming a competitive feature because teams do not want to rewrite their operating rules for every harness.
