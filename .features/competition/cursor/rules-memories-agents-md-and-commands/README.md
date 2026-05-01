# Rules Memories AGENTS MD And Commands

- Harness: Cursor
- Sourced: 2026-05-01

## What it is
Cursor has a layered instruction and reuse system spanning project rules, user rules, AGENTS.md, automatically generated memories, and slash-triggered custom commands stored in the repo.

## Evidence
- Official docs: [Rules](https://docs.cursor.com/context/rules)
- Official docs: [Memories](https://docs.cursor.com/en/context/memories)
- Official docs: [Commands](https://docs.cursor.com/en/agent/chat/commands)
- First-party details:
  - Cursor documents project rules in `.cursor/rules`, user rules in settings, and `AGENTS.md` as a simpler markdown alternative for project-wide instructions
  - the Memories docs say memories are project-scoped, automatically extracted from conversations, and user-approvable before being saved
  - Cursor commands are plain markdown files in `.cursor/commands` that surface as slash commands for reusable workflows
  - the docs also make clear that these instruction surfaces are prompt-level runtime controls, not only passive notes for humans
- Latest development checkpoint:
  - the current docs keep adding structure around rules, memories, and reusable commands, which shows Cursor is formalizing repo-owned agent behavior rather than relying on freeform prompting alone

## Product signal
Cursor's instruction stack is converging on a repo-native contract system, which remains one of the clearest competitive patterns across coding harnesses.
