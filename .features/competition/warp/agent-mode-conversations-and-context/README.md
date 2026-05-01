# Agent Mode Conversations And Context

- Harness: Warp
- Sourced: 2026-04-30

## What it is
Warp's local agent mode runs inside the terminal but treats the session as a structured conversation with reusable context instead of a one-shot prompt box.

## Evidence
- Official docs: [Using Agents](https://docs.warp.dev/features/warp-ai/agent-mode)
- Official docs: [Interacting with Agents](https://docs.warp.dev/agent-platform/agent/using-agents)
- First-party details:
  - Warp exposes an Agent Mode inside the terminal UI rather than a separate chat app
  - agent conversations can be saved, resumed, and used as durable working threads
  - shared context can be attached so the agent sees repo, terminal, and selected workspace information
  - the agent can keep iterating on a task until the user stops it or the configured permission profile blocks the next action
- Latest development checkpoint:
  - Warp's current docs position the agent as a primary product surface, not a sidecar autocomplete feature

## Product signal
Warp is converging the terminal and the agent thread into one place, which matters because coding users increasingly want persistent task context without leaving the shell.
