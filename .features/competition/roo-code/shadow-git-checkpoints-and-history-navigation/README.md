# Shadow Git Checkpoints And History Navigation

- Harness: Roo Code
- Sourced: 2026-05-09

## What it is
Roo automatically snapshots workspace state in a shadow Git repository so users can experiment safely and step backward through prior agent edits without depending on the project's real Git history.

## Evidence
- Official docs: [Checkpoints](https://docs.roocode.com/features/checkpoints)
- Official repo README: [Roo Code](https://github.com/RooCodeInc/Roo-Code)
- First-party details:
  - checkpoints are enabled by default
  - Roo versions workspace files during tasks so users can recover from bad AI edits, compare approaches, and revert to earlier states
  - the checkpoint repository is independent from the user's existing Git configuration and does not require a GitHub account or personal Git identity
  - settings expose checkpoint enablement plus initialization timeout controls
  - the April 23, 2026 `v3.53.0` README adds previous checkpoint navigation controls in chat
- Latest development checkpoint:
  - the April 23, 2026 `v3.53.0` update turns checkpoints from a passive rollback mechanism into a more navigable in-chat history surface

## Product signal
Roo is productizing reversible experimentation as part of the chat loop instead of treating Git literacy as a prerequisite for safe agent use.
