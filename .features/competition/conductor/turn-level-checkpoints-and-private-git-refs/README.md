# Turn-Level Checkpoints And Private Git Refs

- Harness: Conductor
- Sourced: 2026-05-12

## What it is
Conductor snapshots workspace state during the agent conversation and stores those snapshots outside the repo's visible branch history, so users can roll a workspace back to an earlier turn without rewriting the project's main git log.

## Evidence
- Official docs: [Checkpoints](https://www.conductor.build/docs/reference/checkpoints)
- Official changelog: [v0.44.0](https://www.conductor.build/changelog/0.44.0)
- First-party details:
  - checkpoints are created automatically during workspace activity
  - users can restore from earlier chat turns
  - Conductor says checkpoint history is stored in private git refs rather than the visible project branch
  - the `v0.44.0` changelog highlights improved checkpoint behavior for Codex sessions
- Latest development checkpoint:
  - the January 31, 2026 `v0.44.0` release shows checkpoints being actively improved for newer agent runtimes rather than left as a legacy feature

## Product signal
Conductor is making rollback a first-class operational control, which reduces the cost of letting agents act aggressively without polluting repo history or forcing manual git surgery.
