# Reference Architecture: Test-Driven Data Patch Loop (TDDP Loop)

## Goal

Implement a reproducible, typed data-debugging loop inspired by Programming with Data that can plug into agent-browser evaluation and data workflows.

## Architecture overview

```text
┌──────────────────────────────────────────────────────────┐
│ Eval Failure Intake                                      │
│ - failed item id, prompt, output, expected, tags         │
└───────────────┬──────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────┐
│ Failure Localizer                                        │
│ - concept-gap detection                                  │
│ - reasoning-chain break detection                        │
└───────────────┬──────────────────────────────────────────┘
                │ defect candidates
┌───────────────▼──────────────────────────────────────────┐
│ Patch Synthesizer                                        │
│ - retrieval-backed evidence selection                    │
│ - candidate patch templates                              │
└───────────────┬──────────────────────────────────────────┘
                │ patch proposals
┌───────────────▼──────────────────────────────────────────┐
│ Patch Validator                                          │
│ - schema/type checks                                     │
│ - contradiction + policy guards                          │
│ - expected coverage delta threshold                      │
└───────────────┬──────────────────────────────────────────┘
                │ approved patches
┌───────────────▼──────────────────────────────────────────┐
│ Patch Registry + Rollout Planner                         │
│ - versioned patches                                      │
│ - retrain/eval plan                                      │
└──────────────────────────────────────────────────────────┘
```

## Core components

### 1) Eval Failure Intake

Normalizes outputs from eval runs into a typed failure record with:

- benchmark id
- concept tags
- reasoning-edge tags
- severity and confidence

### 2) Failure Localizer

Produces defect clusters by grouping failures around shared concepts/edges and estimating defect impact.

### 3) Patch Synthesizer

Creates structured patch candidates (add / revise / remove examples, augment chains, add counterexamples) tied to cluster evidence.

### 4) Patch Validator

Blocking checks:

- patch schema validity
- unsafe-content policy checks
- contradiction detection against known facts/KB snippets
- projected pass-rate gain over threshold

### 5) Patch Registry + Rollout Planner

Stores accepted patch versions and creates a deterministic next-step plan:

- update training corpus view
- run targeted eval subset
- compare regression metrics

## Safety and quality gates

- Separate immutable policy guardrails from mutable domain data.
- Require evidence references for every patch operation.
- Reject patches that increase contradiction risk or reduce baseline non-domain performance in shadow tests.

## Metrics

- Failure localization precision (manual adjudication sample)
- Pass-rate delta on targeted eval slice
- Regression count on control slice
- Patch acceptance rate
- Time-to-repair from first failure to accepted patch

## Rollout policy

1. Shadow patch scoring only.
2. Limited canary on targeted eval subsets.
3. Promote only when gain and regression constraints pass.
4. Rollback immediately on policy or regression breach.
