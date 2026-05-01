# Workflow Suspend Resume And Human In The Loop

- Harness: Mastra
- Sourced: 2026-05-01

## What it is
Mastra workflows can persist execution state, pause indefinitely for approval or input, and resume later without restarting the run, which makes human checkpoints part of the runtime rather than a manual workaround.

## Evidence
- Official repo: [mastra-ai/mastra README](https://github.com/mastra-ai/mastra)
- Official docs: [Suspend & Resume Workflows](https://mastra.ai/docs/workflows/pausing-execution)
- Official reference: [suspend()](https://mastra.ai/en/reference/legacyWorkflows/suspend)
- Official blog: [You can suspend/resume workflows in playground](https://mastra.ai/blog/resumeworkflows)
- First-party details:
  - the README says agents or workflows can be suspended for human review and resumed later because Mastra stores execution state
  - the suspend/resume docs expose workflow methods like `.resume()`, `.watch()`, and stream-resume APIs
  - the `suspend()` reference says workflow state is persisted and can be continued later
  - the blog says Playground gained suspend/resume plus `resumeStream` so a run can pause, close the stream, and continue from the same point later
- Latest development checkpoint:
  - the current docs still frame indefinite pause and resume as a core workflow primitive, not just a debugging helper or demo surface

## Product signal
Mastra treats approval gates and external waits as normal runtime states, which is strategically important for agents that need to survive long-running operational flows.
