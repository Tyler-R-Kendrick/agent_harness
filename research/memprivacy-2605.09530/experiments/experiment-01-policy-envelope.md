# Experiment 01 — Policy Envelope Scaffold

## Objective

Validate that a typed reversible envelope can enforce PL-threshold masking while preserving semantic placeholders suitable for cloud memory operations.

## Hypothesis

Compared with naive `***` masking, typed placeholders will preserve structural semantics and enable accurate reversible restoration under deterministic policy control.

## Setup

- Input: synthetic mixed-sensitivity chat turns.
- Policies: `minProtectedLevel=PL2` and `minProtectedLevel=PL4`.
- Baselines:
  - Plaintext passthrough.
  - Naive full masking (`***`).
- Variant:
  - TRPE typed placeholder masking.

## Procedure

1. Run sample corpus through TRPE with policy threshold PL2.
2. Assert all PL2+ entities are replaced with typed placeholders.
3. Assert PL1 entities remain plain unless policy changed.
4. Round-trip restore cloud response and assert exact restoration.
5. Enforce lifecycle cleanup and assert PL4 mappings are purged.

## Acceptance criteria

- 100% policy-compliant masking for entities at/above threshold.
- 100% placeholder round-trip restoration on test fixtures.
- 100% PL4 retention rule compliance (no post-response residue).

## Artifacts

- Scaffold implementation (`experiment-01-trpe-scaffold.ts`).
- Deterministic fixtures and assertions embedded in the scaffold demo loop.
