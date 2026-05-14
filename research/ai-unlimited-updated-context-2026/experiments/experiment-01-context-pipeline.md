# Experiment 01 — Context Pipeline Scaffold

## Hypothesis

A deterministic TypeScript pipeline implementing `Raw -> Pending -> Wiki -> Hot -> Log` can produce portable, continuously updated context bundles for agent-browser runtimes.

## Setup

- Implement minimal typed pipeline primitives.
- Use in-memory adapters for reproducible local execution.
- Run loop with synthetic source updates.

## Procedure

1. Seed source store with baseline documents.
2. Run ingestion to populate pending queue.
3. Compile pending items into wiki pages.
4. Build hot context using size budget.
5. Record run event in audit log.
6. Repeat after adding a new source and verify delta behavior.

## Acceptance criteria

- Pipeline run is deterministic for identical inputs.
- All hot context lines are traceable to sources.
- Log contains one event per run with changed counts.
- Hot context respects configured budget.

## Artifacts

- `experiment-01-context-pipeline.ts` (reference implementation scaffold)
- terminal check output from TypeScript compile
