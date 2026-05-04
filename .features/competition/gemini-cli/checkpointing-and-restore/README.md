# Checkpointing And Restore

- Harness: Gemini CLI
- Sourced: 2026-05-04

## What it is
Gemini CLI includes built-in conversation checkpointing so users can snapshot a run, explore risky branches, and restore a known-good state without manually reconstructing context.

## Evidence
- Official docs: [Checkpointing](https://geminicli.com/docs/cli/checkpointing/)
- First-party details:
  - Gemini CLI can create checkpoints of the current conversation state and later restore them.
  - The docs frame checkpoints as a way to experiment safely, back out of bad turns, and revisit earlier decision points.
  - Restore is treated as a first-class CLI action rather than an external git-only workaround.
- Latest development checkpoint:
  - checkpointing remains documented as a core CLI feature in the current product docs as of May 4, 2026.

## Product signal
Gemini CLI treats session state as something users should branch and recover explicitly. That is a clear sign that harness UX is moving toward reversible operational state instead of one-way chat logs.
