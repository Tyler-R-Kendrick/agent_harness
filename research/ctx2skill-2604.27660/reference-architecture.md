# Reference Architecture: Context Skill Self-Play Loop (CSSL)

## Goal

Implement a TypeScript-first approximation of Ctx2Skill suitable for agent-browser runtime services.

## Architecture overview

```text
┌──────────────────────────────────────────────────────────┐
│ Context Package                                          │
│ - raw context text / documents                           │
│ - metadata + segmentation                                │
└───────────────┬──────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────┐
│ Self-Play Orchestrator                                   │
│ - Challenger runner                                      │
│ - Reasoner runner                                        │
│ - Judge runner                                           │
│ - Outcome router                                         │
└───────────────┬──────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────┐
│ Skill Evolution Engine                                   │
│ - Reasoner proposer + generator                          │
│ - Challenger proposer + generator                        │
│ - Immutable skill history                                │
└───────────────┬──────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────┐
│ Cross-Time Replay Selector                               │
│ - hard/easy probe sets                                   │
│ - laplace-smoothed scoring                               │
│ - best snapshot selection                                │
└───────────────┬──────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────┐
│ Deployment Adapter                                       │
│ - selected Reasoner skills injected at inference         │
│ - telemetry + rollback to prior snapshot                 │
└──────────────────────────────────────────────────────────┘
```

## Components

### 1) Self-Play Orchestrator

Controls iterations and enforces strict adversarial separation (no cross-conditioning on opponent skills).

### 2) Skill Evolution Engine

Uses side-specific proposer diagnostics plus generator materialization to produce full replacement skill sets.

### 3) Probe Curator

At each round, captures:
- Hard probe: failed case with lowest rubric pass rate.
- Easy probe: solved case with minimal rubric cardinality.

### 4) Cross-Time Replay Selector

Re-scores every candidate Reasoner skill snapshot against all probes and computes:

- `rhoHard(i) = (hardSolved + 1) / (|hard| + 1)`
- `rhoEasy(i) = (easySolved + 1) / (|easy| + 1)`
- `score(i) = rhoHard(i) * rhoEasy(i)`

Returns the max-score snapshot index.

## Validation gates

- Typed schema checks for skills/tasks/rubrics.
- Deterministic replay with fixed seed for experiment runs.
- Guardrail policy to reject unbounded growth in redundant skill entries.

## Rollout policy

1. Offline replay validation.
2. Shadow inference with selected skills.
3. Canary % rollout by context domain.
4. Full rollout with auto-rollback if rubric proxy metrics regress.

## Metrics

- Task solved rate (all-rubric pass definition).
- Hard/easy replay score trend by iteration.
- Skill growth rate and deduplication ratio.
- Transfer gain when applying skills to unseen tasks over same context.
