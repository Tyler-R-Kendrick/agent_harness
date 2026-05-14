# Experiment 01 — StraTA-style Strategy Loop Scaffold

## Hypothesis

A two-level policy (strategy + actions) with periodic critical self-judgment improves windowed reward and recovery speed versus a purely reactive baseline scaffold.

## Setup

- Implementation: `experiment-01-strategy-loop.ts`
- Environment: deterministic mock environment adapter.
- Budget: 300 steps, adaptation every 30 steps.
- Baseline: same action policy without strategy replacement.

## Procedure

1. Initialize context and generate 3 strategy candidates.
2. Evaluate each over a small warmup horizon.
3. Select best strategy and run main loop.
4. At adaptation boundaries, judge performance:
   - if score < threshold, refine or resample.
5. Capture event log, strategy churn, and final score.

## Acceptance criteria

- Loop compiles and runs deterministically.
- Strategy decision path is explicit and typed.
- Safety gate blocks invalid strategy updates.
- Logged artifacts are sufficient for replay and inspection.

## Artifacts

- Strategy event timeline.
- Windowed score series.
- Final strategy snapshot.
