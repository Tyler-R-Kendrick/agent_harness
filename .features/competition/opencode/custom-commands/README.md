# Custom Commands

- Harness: OpenCode
- Sourced: 2026-04-28

## What it is
OpenCode lets teams package repeatable prompt workflows as slash commands backed by markdown files or config entries.

## Evidence
- Official docs: [Commands](https://opencode.ai/docs/commands/)
- First-party details:
  - custom commands are defined in a `commands/` directory or in `opencode.json`
  - command definitions can set a description, target agent, and model
  - commands support arguments like `$ARGUMENTS`, positional parameters such as `$1`, and shell-output injection
  - built-in commands include `/init`, `/undo`, `/redo`, `/share`, and `/help`

## Product signal
OpenCode packages workflow reuse as a native command system instead of relying on copy-pasted prompts.
