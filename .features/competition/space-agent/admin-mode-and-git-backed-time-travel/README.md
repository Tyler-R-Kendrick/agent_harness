# Admin Mode And Git Backed Time Travel

- Harness: Space Agent
- Sourced: 2026-04-30

## What it is
Space Agent gives operators a stable admin plane plus Git-backed history so user or group changes can be rolled back without taking the whole system down.

## Evidence
- Official README: [agent0ai/space-agent](https://github.com/agent0ai/space-agent)
- Official runtime params: [commands/params.yaml](https://raw.githubusercontent.com/agent0ai/space-agent/main/commands/params.yaml)
- First-party details:
  - the README explicitly calls out persistent admin and time travel
  - it says admin mode provides a stable control plane when something breaks
  - the same section says Git-backed history lets operators roll back user or group changes
  - `CUSTOMWARE_GIT_HISTORY` is a runtime parameter, which shows Git-backed local history is a supported product behavior rather than a hidden implementation trick
- Latest development checkpoint:
  - the current configuration surface still exposes Git-history controls at runtime, suggesting rollback and history remain important operational primitives as the product scales

## Product signal
Space Agent treats agent customization as something operators must safely undo, which is stronger governance posture than products that only offer chat history or one-shot revert.
