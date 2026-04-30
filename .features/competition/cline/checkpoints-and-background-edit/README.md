# Checkpoints And Background Edit

- Harness: Cline
- Sourced: 2026-04-30

## What it is
Cline combines reversible checkpointing with a background-edit mode so the agent can keep changing files without constantly stealing editor focus.

## Evidence
- Official docs: [Checkpoints](https://docs.cline.bot/core-workflows/checkpoints)
- Official docs: [Background Edit](https://docs.cline.bot/features/background-edit)
- First-party details:
  - checkpoints save a snapshot every time Cline modifies a file or runs a command
  - snapshots are stored in a shadow Git repository separate from the project's real history
  - Background Edit writes directly to files without opening new diff tabs
  - file changes stream into collapsible chat-panel diffs with additions and deletions at a glance
- Latest development checkpoint:
  - the official `v3.80.0` release dated April 22, 2026 says foreground terminal mode was removed and command execution now defaults to background mode

## Product signal
The product is pushing toward non-blocking agent execution with fast rollback, which is a strong pattern for keeping humans in flow while the harness keeps working.
