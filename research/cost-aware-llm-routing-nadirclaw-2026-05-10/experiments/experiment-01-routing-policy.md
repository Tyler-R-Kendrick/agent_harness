# Experiment 01: Deterministic Local Routing Policy

## Hypothesis

A deterministic local classifier can cut estimated model cost by routing clearly simple prompts to a cheap model while preserving quality guardrails through confidence and escalation rules.

## Setup

- Implementation: `experiments/router-sim/src/routingPolicy.ts`
- Test runner: Vitest with v8 coverage, threshold 100%.
- Models:
  - Cheap: `gemini-3-flash`
  - Premium: `gemini-2.5-pro`

## Procedure

1. Score each prompt using local rules.
2. Route by threshold (`0.55`) with confidence gate (`0.25`).
3. Apply escalation terms (`security`, `compliance`, `incident`, `outage`).
4. Produce decision record with reason vector.

## Acceptance criteria

- All branches in routing policy covered by tests.
- Complex prompts route to premium.
- Simple prompts route to cheap unless confidence/escalation gate triggers.
- Structured decision output includes tier, confidence, score, chosen model, and reasons.

## Artifacts

- `router-sim/src/routingPolicy.ts`
- `router-sim/src/__tests__/routingPolicy.test.ts`
- Coverage report from `npm run test:coverage` in `router-sim/`
