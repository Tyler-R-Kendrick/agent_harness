# Experiment 01: Cost-Aware Routing Simulation

## Hypothesis

A deterministic local classifier with tier thresholds can reduce blended request cost by at least 35% while keeping premium routing for complexity-heavy prompts.

## Setup

- Input corpus: synthetic prompts mapped to expected tier classes (`cheap`, `balanced`, `premium`).
- Routing engine: `experiment-01-routing-scaffold.ts`.
- Cost table:
  - cheap: $0.10 / 1M tokens
  - balanced: $0.35 / 1M tokens
  - premium: $1.25 / 1M tokens
- Baseline: all requests routed to premium tier.

## Procedure

1. Run all prompts through classifier + routing policy.
2. Record assigned tiers and estimated cost.
3. Compare blended cost vs premium-only baseline.
4. Compute mismatch count where expected premium prompt is not premium routed.

## Acceptance criteria

- Blended cost reduction >= 35% vs premium-only baseline.
- Zero premium false negatives on the labeled corpus.
- Router overhead in this simulation path remains deterministic and side-effect free.

## Artifacts

- TypeScript scaffold and deterministic simulation output in console logs.
