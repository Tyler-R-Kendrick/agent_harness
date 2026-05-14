# Reference Architecture: Rubric-Guided Stage Runtime (RGSR)

## Goal

Implement a deterministic, auditable approximation of RubricEM in our TypeScript stack:

- Stage-aware execution for long-form tasks.
- Stage-level credit assignment beyond binary final reward.
- Reflection-based meta-policy updates for future attempts.

## Architecture overview

```text
┌──────────────────────────────────────────────────────────────┐
│ Task Intake + Rubric Builder                                │
│ - task normalization                                         │
│ - rubric stage schema generation                             │
└───────────────┬──────────────────────────────────────────────┘
                │ rubric plan
┌───────────────▼──────────────────────────────────────────────┐
│ Stage Runtime Orchestrator                                  │
│ - PLAN stage policy                                          │
│ - EVIDENCE stage policy                                      │
│ - REVIEW stage policy                                        │
│ - SYNTHESIS stage policy                                     │
└───────────────┬──────────────────────────────────────────────┘
                │ stage outputs + traces
┌───────────────▼──────────────────────────────────────────────┐
│ Stage Judge + Credit Assigner                               │
│ - rubric dimension scoring                                   │
│ - stage-weighted aggregation (SS-GRPO proxy)                │
└───────────────┬──────────────────────────────────────────────┘
                │ judged trajectory
┌───────────────▼──────────────────────────────────────────────┐
│ Reflection Meta-Policy Engine                               │
│ - extract reusable guidance                                  │
│ - update shared stage memory                                 │
│ - version + rollback                                         │
└───────────────┬──────────────────────────────────────────────┘
                │ updated guidance profile
┌───────────────▼──────────────────────────────────────────────┐
│ Next Attempt / Next Task                                    │
│ - conditions stage prompts/decisions on memory profile       │
└──────────────────────────────────────────────────────────────┘
```

## Component contracts

### 1) Task Intake + Rubric Builder

- Input: raw user task and context.
- Output: typed rubric with stages and dimensions.
- Constraint: every stage must define measurable criteria and weight.

### 2) Stage Runtime Orchestrator

- Executes stages sequentially and emits stage trace records.
- Keeps strict boundaries between stage inputs/outputs to avoid hidden coupling.

### 3) Stage Judge + Credit Assigner

- Scores each stage against rubric dimensions.
- Emits per-stage score plus normalized total credit.
- Supports weighting to bias bottleneck stages (usually EVIDENCE and REVIEW).

### 4) Reflection Meta-Policy Engine

- Consumes judged trajectory.
- Produces typed guidance deltas (avoid free-form global prompt mutation).
- Applies validator gates before promotion to active memory profile.

## Safety and validation gates

- Schema validation for rubric and reflection updates.
- Stage score clipping and anomaly detection (outlier guardrails).
- Memory profile rollback if next-attempt quality regresses beyond threshold.

## Rollout policy

1. Shadow mode: record rubric and scores without influencing live policy.
2. Canary mode: apply memory updates to limited task subset.
3. Full mode: promote memory profile globally when canary is stable.

## Metrics

- Stage completion quality by dimension.
- Total trajectory credit trend.
- Reflection uptake rate (accepted vs rejected updates).
- Improvement delta between baseline and rubric-guided runtime.
- Regression and rollback frequency.

## Integration plan for agent-browser

- Add rubric schema and stage trace types under agent runtime typing surface.
- Attach stage judge and meta-policy updater as optional middleware in chat-agent loop.
- Persist trajectory + reflection artifacts for eval playback in `agent-browser/evals`.
- Promote from scaffold to production via feature flag.
