# Interactive TUI And Queued Steering

- Harness: Pi
- Sourced: 2026-04-30

## What it is
Pi ships an interactive terminal UI with file references, image paste support, slash commands, custom keybindings, and a message queue that lets humans steer an agent while it is still working.

## Evidence
- Official coding-agent README: [packages/coding-agent/README.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md)
- First-party details:
  - the README's Interactive Mode section documents fuzzy file reference via `@`, path completion, image paste, `!command` and `!!command`, slash commands, custom keybindings, and transport/model controls
  - message queue behavior is explicit: `Enter` queues a steering message after the current assistant turn, while `Alt+Enter` queues a follow-up after the current work finishes
  - the same page includes official screenshots for Interactive Mode and the session tree UI
- Latest development checkpoint:
  - the late-April 2026 release notes add a searchable `/login` provider selector and continue refining the terminal interaction layer rather than replacing it with a hidden background service

## Product signal
Pi treats the terminal itself as the orchestration surface, but makes that surface much more conversational and interruptible than a plain REPL.
