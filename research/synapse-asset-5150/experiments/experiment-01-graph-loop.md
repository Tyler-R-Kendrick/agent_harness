# Experiment 01: Typed Graph Loop Scaffold

## Hypothesis

A typed graph orchestrator with guard-validated transitions can model the harness loop deterministically while retaining extensibility for nested flows.

## Setup

- Implementation file: `experiment-01-graph-loop.ts`
- Runtime: TypeScript (no external dependencies)
- Scenario graph: `plan -> act -> observe -> (act | done)`

## Procedure

1. Define graph nodes and transition guards.
2. Execute loop with a simple blackboard carrying `attempts` and `goalMet`.
3. Record execution trace and final blackboard.
4. Verify deterministic transition behavior across repeated runs.

## Acceptance criteria

- Graph executes to terminal state in bounded steps.
- Every transition is allowed by graph definition and guard.
- Blackboard updates are preserved across steps.
- Trace captures nodes and transition reasons.

## Artifacts

- `experiment-01-graph-loop.ts` (reference scaffold)
