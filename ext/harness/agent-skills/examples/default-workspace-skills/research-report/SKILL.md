---
name: research-report
description: Runs scoped research as a composite skill through the shared skill registry and router.
---

# Research report

Use `research-report` when a request needs staged evidence gathering and synthesis.

## Execution contract

- Parent skill resolves child skills using the same skill registry/router used by other skills.
- Parent task id is required and reused for all child steps.
- Intermediate outputs are stored in a scoped execution context keyed by the parent task id.
- `stepBudget` limits child step count for the run.
- Telemetry fields emitted per stage: `parentTaskId`, `stageName`, `stageType`, `depth`, `success`, `childSkillName`.

## Suggested child stages

1. `collect-sources`
2. `summarize-evidence`
3. `draft-report`
