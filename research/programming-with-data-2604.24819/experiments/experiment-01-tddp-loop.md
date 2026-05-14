# Experiment 01 — TDDP Loop Scaffold

## Objective

Demonstrate a minimal deterministic implementation that maps failures to defect clusters and emits validated patch plans.

## Hypothesis

Localized, typed patch proposals improve targeted-eval pass-rate potential compared with undifferentiated "add more data" strategy.

## Setup

- Input: synthetic failure set with concept/reasoning tags.
- Baseline: global patch strategy (single broad patch bucket).
- Variant: TDDP Loop clustering + validation gates.

## Procedure

1. Feed identical failure records to baseline and TDDP scaffold.
2. Compare number of specific actionable patches.
3. Compare validator pass rate and projected coverage gain.
4. Inspect rejected patches for safety/quality reasons.

## Acceptance criteria

- TDDP emits >=2 distinct validated cluster-specific patches.
- Each accepted patch includes evidence references and expected gain.
- Validator rejects contradictory or under-threshold patches.

## Artifacts

- Localizer cluster report
- Patch candidate list with validation decisions
- Accepted patch registry snapshot

## Implementation target

- TypeScript scaffold with strongly typed records and deterministic scoring.
- No external model dependency required for v0.
