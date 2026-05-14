# Experiment 01 — Drift Reliability Loop Scaffold

## Objective

Demonstrate that drift-aware policy switching improves reliability signals over a static answering policy.

## Hypothesis

A severity-conditioned policy with verification gates yields fewer risky passes (low-evidence + high-confidence answers) than a static policy.

## Setup

- Deterministic synthetic turn set with known drift labels.
- Baseline: always-normal answer policy.
- Variant: DARL policy selector + verification gate loop.

## Procedure

1. Replay the same turn set for both baseline and DARL variant.
2. Record gate outcomes and final response mode.
3. Compare risky-pass rate and abstention-adjusted reliability score.

## Acceptance criteria

- DARL reduces risky-pass rate by >=20% vs baseline, OR
- DARL matches risky-pass rate while reducing false-confidence events.

## Artifacts

- Per-turn run log (severity, policy, gate result, retries).
- Aggregate table for baseline vs DARL.
