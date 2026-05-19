# Profiles Permissions And Run Until Completion

- Harness: Warp
- Sourced: 2026-05-19

## What it is
Warp lets teams define reusable autonomy profiles for models, commands, MCP access, and approval behavior, including a run-until-completion mode that fully auto-approves the current task.

## Evidence
- Official docs: [Profiles & permissions](https://docs.warp.dev/agent-platform/capabilities/agent-profiles-permissions/)
- Official docs: [Agents overview](https://docs.warp.dev/agents)
- First-party details:
  - profiles capture base model choice, autonomy, command allowlists and denylists, and MCP access rules
  - Warp explicitly documents that the denylist overrides broader allow settings, which makes safety policy an explicit product contract
  - run-until-completion auto-approves commands for the current task and Warp notes that it bypasses the denylist entirely
  - profile reuse reduces repeated approval steering across recurring workflows instead of keeping permissions as ephemeral chat state
- Latest development checkpoint:
  - current Warp docs make permissions and full-autonomy controls a first-class configuration layer around agent behavior rather than a scattered series of one-off prompts

## Product signal
This is a strong signal that agent UX is moving toward explicit policy presets, which lowers friction for repeated work without pretending that approval and trust settings should stay implicit.
