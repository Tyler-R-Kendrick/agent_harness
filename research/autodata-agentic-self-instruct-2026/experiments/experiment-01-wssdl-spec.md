# Experiment 01 — WSSDL deterministic scaffold

## Hypothesis

A typed multi-agent loop with explicit quality and gap gates can deterministically separate accepted vs rejected samples and produce actionable failure telemetry.

## Setup

- Implementation: `experiment-01-wssdl-scaffold.ts`
- Runtime: Node + TypeScript only (no external model calls)
- Source set: synthetic paper snippets
- Solvers: deterministic mock weak/strong scorers

## Procedure

1. Run orchestrator over synthetic docs.
2. Execute up to `maxRounds` per doc.
3. Record each round: verifier result, weak score, strong score, gap, acceptance decision.
4. Aggregate summary metrics.

## Acceptance criteria

- At least one sample accepted and one rejected in the same run.
- All rejection paths include structured failure codes.
- Repeat runs with the same seed produce identical outcomes.

## Artifacts

- Console output from `runDemoExperiment()`
- Accepted sample payload(s)
- Failure telemetry summary by code
