# Profiles Permissions And Run Until Completion

- Harness: Warp
- Sourced: 2026-04-30

## What it is
Warp lets teams define how autonomous the agent should be through Profiles and Permissions, including modes that allow the agent to keep running until it finishes the requested work.

## Evidence
- Official docs: [Agent Profiles & Permissions](https://docs.warp.dev/agents/using-agents/agent-profiles-permissions)
- Official docs: [Using Agents](https://docs.warp.dev/features/warp-ai/agent-mode)
- First-party details:
  - permission profiles govern what the agent can read, write, and execute before asking again
  - Warp documents autonomy levels that range from more supervised execution to more continuous run-until-done behavior
  - profiles can be reused instead of re-answering the same approval questions every session
  - the permission system is part of the product model for both local and remote agent work
- Latest development checkpoint:
  - current Warp docs make permissions a first-class configuration layer around agent behavior rather than a scattered per-command prompt

## Product signal
This is a strong signal that agent UX is moving toward explicit policy presets, which lowers friction for repeated work without removing the user's safety controls.
