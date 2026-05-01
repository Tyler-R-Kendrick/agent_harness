# Suspend, Resume, And Human-In-The-Loop Workflows

- Harness: Mastra
- Sourced: 2026-05-01

## What it is
Mastra workflows can pause mid-execution, persist a snapshot of state, and resume later from a specific step when a human decision, external event, or time-based trigger arrives.

## Evidence
- Official docs: [Suspend & Resume](https://mastra.ai/docs/workflows/suspend-and-resume)
- First-party details:
  - Mastra says workflows can pause at any step to collect more data, wait for callbacks, throttle operations, or request human input.
  - Suspended state is saved as a snapshot in the configured storage provider and survives deployments and application restarts.
  - `resume()` restarts the workflow from the paused step with typed `resumeData`.
  - workflow-level sleep and event primitives also support longer-running waits through `.sleep()`, `.sleepUntil()`, `.waitForEvent()`, and `.sendEvent()`.
- Latest development checkpoint:
  - the current docs present suspend/resume and human-in-the-loop as standard workflow capabilities rather than special-case recipes

## Product signal
Mastra treats long-running, interruptible workflows as normal. That is important because mature harnesses increasingly need pause, approval, and deferred continuation semantics instead of assuming every task fits inside one synchronous foreground turn.
