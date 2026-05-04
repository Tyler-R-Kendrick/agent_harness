# Chapters And Context Compression

- Harness: Gemini CLI
- Sourced: 2026-05-04

## What it is
Gemini CLI recently added chaptered narrative flow and a dedicated context compression service so long-running sessions stay coherent, navigable, and smaller than a raw transcript replay.

## Evidence
- Official changelog: [Gemini CLI changelogs](https://geminicli.com/docs/changelogs/)
- First-party details:
  - the v0.38.0 preview release notes call out `Chapters Narrative Flow` as a new way to structure long sessions
  - the same release adds a `Context Compression Service`
  - the v0.39.0 notes describe a decoupled `ContextManager`, which reinforces that session-shaping and compression are active areas of harness work
- Latest development checkpoint:
  - chaptering and compression appeared in the April 2026 preview line and context management work continued in the May 2026 stable notes.

## Product signal
Gemini CLI is treating context bloat as a product problem the harness should solve for the user. That is a meaningful shift from passive transcript accumulation toward actively managed long-session ergonomics.
