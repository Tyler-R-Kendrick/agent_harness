# Auto Memory And Skill Extraction

- Harness: Gemini CLI
- Sourced: 2026-05-04

## What it is
Gemini CLI now turns repeated user preferences and reusable procedures into explicit memory proposals, then lets users approve and persist those learnings through a built-in `/memory` workflow instead of burying them inside transcript state.

## Evidence
- Official docs: [Auto Memory](https://geminicli.com/docs/cli/auto-memory/)
- Official changelog: [Gemini CLI v0.39.0](https://geminicli.com/docs/changelogs/)
- First-party details:
  - Gemini CLI extracts candidate memories and reusable skills from conversation history.
  - New memories land in a user-visible inbox for review instead of being silently committed.
  - Accepted learnings can be written back into persistent context, which makes memory capture part of the product workflow rather than an undocumented prompt trick.
  - The v0.39.0 release notes call out Auto Memory as a newly shipped capability.
- Latest development checkpoint:
  - Auto Memory was highlighted in the May 2026 v0.39.0 release as a fresh harness capability, not legacy behavior.

## Product signal
Gemini CLI is productizing memory capture as an operator-reviewed loop. That is a stronger pattern than passive transcript retention because it makes the harness explain what it learned and lets teams keep only the durable steering they actually want.
