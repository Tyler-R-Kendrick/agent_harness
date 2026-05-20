# Canvas And Agent-Controlled UI

- Harness: OpenClaw
- Sourced: 2026-05-20

## What it is
OpenClaw exposes a lightweight visual workspace called Canvas that the agent can navigate, script, snapshot, and update while keeping session-scoped state on the operator machine.

## Evidence
- Official docs: [Canvas](https://docs.openclaw.ai/platforms/mac/canvas)
- First-party details:
  - Canvas content is stored under `~/Library/Application Support/OpenClaw/canvas/<session>/...`
  - the agent can show or hide the panel, navigate to local or remote URLs, evaluate JavaScript, and capture a snapshot image
  - the panel remembers size and position per session and auto-reloads when local canvas files change
  - OpenClaw exposes A2UI rendering inside Canvas, including `beginRendering`, `surfaceUpdate`, `dataModelUpdate`, and `deleteSurface`
  - the docs explicitly call out directory-traversal blocking and session-root confinement for local canvas content
- Latest development checkpoint:
  - the current Canvas docs position it as an agent-controlled UI surface rather than a static preview pane, including first-party A2UI support and snapshot capture

## Product signal
OpenClaw is treating lightweight GUI output as part of the runtime contract. That raises the bar from “agent can message you” to “agent can also own a visual surface with persistent per-session state.”
