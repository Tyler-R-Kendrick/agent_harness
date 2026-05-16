# IDE Cloud Delegation And Local Follow-Through

- Harness: Codex
- Sourced: 2026-05-16

## What it is
The Codex IDE extension can offload larger jobs to Codex Cloud, then bring the resulting task back into the editor so the user can review, apply, test, and continue locally with preserved context.

## Evidence
- Official docs: [Codex IDE extension features](https://developers.openai.com/codex/ide/features)
- First-party details:
  - the IDE extension runs in VS Code, Cursor, Windsurf, and other VS Code-compatible editors
  - users can switch models and reasoning effort from the extension UI
  - the extension supports `Chat`, `Agent`, and `Agent (Full Access)` approval modes
  - users can choose `Run in the cloud`, select an environment, and start from `main` or from local changes
  - when a cloud task finishes, the extension can load it back into the IDE, and continuing locally preserves conversation context
- Latest development checkpoint:
  - the current Codex IDE flow explicitly supports handing one task back and forth between remote execution and local completion instead of treating cloud work as a separate product

## Product signal
Codex is productizing a hybrid execution loop where cloud scale and local finishing are part of one continuous developer experience.
