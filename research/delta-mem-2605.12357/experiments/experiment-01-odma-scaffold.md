# Experiment 01 — ODMA loop scaffold

## Hypothesis

A fixed-size online delta memory can improve delayed-fact recall in an agent loop compared with a no-memory baseline, while keeping bounded state size.

## Setup

- Language: TypeScript
- Artifact: `experiment-01-odma.ts`
- Scenario: synthetic event stream with delayed recall queries
- Memory size: `8 x 8`
- Learning rate: `0.2`

## Procedure

1. Initialize ODMA with zero matrix state.
2. Feed deterministic sequence of events (facts + distractors).
3. Issue queries for earlier facts after delay.
4. Compare readout score from memory-enabled run vs no-update control.
5. Log hit/miss and average recall score.

## Acceptance criteria

- Scaffold compiles with `npx tsc --noEmit`.
- Experiment prints deterministic summary stats.
- Memory-enabled recall score exceeds no-memory control on included trace.

## Artifacts

- Console summary from scaffold run.
- This spec and the architecture document in the same packet.
