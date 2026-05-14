# Experiment 01 — Loop Scaffold

## Objective

Build the smallest runnable scaffold of an online adaptation loop.

## Hypothesis

Even with simple heuristics (no model fine-tuning), periodic harness edits improve trajectory efficiency versus a static harness.

## Setup

- Environment: toy gridworld or deterministic simulator.
- Baseline: static prompt + fixed planning policy.
- Variant: OHAL with periodic adaptation every 50 steps.

## Procedure

1. Run baseline for 5 seeds.
2. Run OHAL scaffold for 5 seeds.
3. Compare median steps-to-goal and failure count.

## Harness mutation surface (v0)

- Planner depth
- Tool-selection strategy
- Memory retention window
- Reflection prompt suffix

## Acceptance criteria

- >=10% median improvement in steps-to-goal OR
- same performance with lower variance across seeds.

## Artifacts to capture

- Trajectory logs per seed
- Harness version history
- Promotion/rollback events
- Aggregate metrics table


## Implementation target

- Implement the loop using TypeScript modules compatible with the agent-browser stack.
- Keep environment adapters and harness mutation policy strongly typed.
