# Custom Commands

- Harness: OpenCode
- Sourced: 2026-04-27

## What it is
OpenCode lets teams package repeatable workflows as slash commands stored in project or global markdown/config files.

## Evidence
- Official docs: [Commands](https://opencode.ai/docs/commands/)
- First-party details:
  - command files can live under `.opencode/commands/` or `~/.config/opencode/commands/`
  - commands can specify description, prompt template, agent, and model
  - built-in commands include `/init`, `/undo`, `/redo`, `/share`, and `/help`
  - project-local command files let teams check workflow prompts into the repo

## Product signal
OpenCode is turning prompt recipes into durable, discoverable workflow primitives instead of leaving them in chat history.
