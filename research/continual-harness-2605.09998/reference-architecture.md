# Reference Architecture: Online Harness Adaptation Loop (OHAL)

## Goal

Implement a production-friendly approximation of Continual Harness for agent systems:

- Online adaptation
- No episode reset requirement
- Controlled self-modification

## Architecture overview

```text
┌──────────────────────────────────────────────────────────┐
│ Environment Adapter                                      │
│ (observations, actions, reward/events, constraints)      │
└───────────────┬──────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────┐
│ Runtime Agent Loop                                       │
│ - Planner                                                │
│ - Tool executor                                          │
│ - Short-term memory                                      │
└───────────────┬──────────────────────────────────────────┘
                │ emits trajectories
┌───────────────▼──────────────────────────────────────────┐
│ Trajectory Store                                         │
│ - append-only log                                        │
│ - chunking + retrieval                                   │
└───────────────┬──────────────────────────────────────────┘
                │ sampled windows
┌───────────────▼──────────────────────────────────────────┐
│ Adaptation Engine                                        │
│ - Evaluator (process reward / proxy metrics)             │
│ - Editor (propose prompt/tool/memory changes)            │
│ - Validator (safety + regression checks)                 │
│ - Promoter (versioned rollout / canary)                  │
└───────────────┬──────────────────────────────────────────┘
                │ approved harness version
┌───────────────▼──────────────────────────────────────────┐
│ Harness Registry                                         │
│ - active config                                          │
│ - version history + rollback                             │
└──────────────────────────────────────────────────────────┘
```

## Components

### 1) Environment Adapter

Defines the minimal game/task interface:

- `observe() -> Observation`
- `act(Action) -> Transition`
- `constraints() -> PolicyConstraints`

### 2) Runtime Agent Loop

Runs continuously using the currently active harness version.

### 3) Trajectory Store

Captures `(obs, thought/plan, action, outcome, reward proxies)` tuples with timestamps and harness version tags.

### 4) Adaptation Engine

- **Evaluator**: finds failure/success motifs.
- **Editor**: generates candidate harness diffs.
- **Validator**: checks safety + quality thresholds.
- **Promoter**: gradual deploy (shadow -> canary -> full).

### 5) Harness Registry

Source of truth for active harness and rollback targets.

## Online update policy

- Trigger adaptation every `K` steps or on stagnation.
- Maintain max one active candidate rollout.
- Roll back immediately on safety-policy breach or QoS drop.

## Practical constraints

- Self-edits must be typed/structured (JSON patch), not raw free-text when possible.
- Keep immutable guardrails separate from mutable optimization regions.
- Track all mutations with audit metadata.

## Metrics

- Task progress rate / milestone velocity
- Action efficiency (e.g., button presses per milestone)
- Regression rate after promotion
- Rollback frequency
- Safety violation count

## Mapping to implementation phases

1. **Phase A**: fixed evaluator + manual editor templates.
2. **Phase B**: LLM-generated candidate edits with validator gates.
3. **Phase C**: teacher relabel + policy fine-tuning loop.

