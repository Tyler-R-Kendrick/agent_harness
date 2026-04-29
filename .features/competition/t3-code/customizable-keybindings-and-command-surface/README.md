# Customizable Keybindings And Command Surface

- Harness: T3 Code
- Sourced: 2026-04-29

## What it is
T3 Code exposes a configurable command surface for keyboard-driven workflows, terminal management, project scripts, and command-palette actions.

## Evidence
- Keybindings doc: [KEYBINDINGS.md](https://raw.githubusercontent.com/pingdotgg/t3code/main/KEYBINDINGS.md)
- GitHub Releases: [T3 Code releases](https://github.com/pingdotgg/t3code/releases)
- First-party details:
  - keybindings are loaded from `~/.t3/keybindings.json`
  - commands include terminal toggle/split/new/close, global command palette, chat creation, local chat creation, and "open in editor"
  - arbitrary project scripts can be invoked through `script.{id}.run`
  - the 2026-04-15 nightly release mentions a "command palette project picker"

## Product signal
T3 Code is productizing agent workflow acceleration as configurable commands instead of leaving everything in chat prompts.
