# Full Terminal Use In Live Interactive Programs

- Harness: Warp
- Sourced: 2026-05-19

## What it is
Warp's agent can attach to already running interactive terminal programs and operate inside the live PTY instead of being limited to one-shot shell commands.

## Evidence
- Official docs: [Full Terminal Use](https://docs.warp.dev/agents/full-terminal-use)
- Official docs: [Universal Input](https://docs.warp.dev/terminal)
- First-party details:
  - Warp documents agent control inside interactive tools such as `psql`, `vim`, `python`, `gdb`, `top`, and long-running dev servers
  - the agent can read the live terminal buffer, write back into the PTY, respond to prompts, and continue working inside the active process
  - users can either ask the agent to start an interactive app or attach the agent after the process is already running
  - this turns the terminal session itself into an interactive tool surface instead of forcing the user to restart work in a separate sandbox or chat
- Latest development checkpoint:
  - current Warp docs frame this as a core agent capability, which materially differentiates the harness from chat-first tools that still treat terminal interaction as detached command execution

## Product signal
Warp is pushing toward terminal-native agents that can collaborate inside the actual runtime context, not just around it.
