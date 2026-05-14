# Experiment 01 — Grouped Curation Scaffold

## Objective

Demonstrate a deterministic SkillOS-like curation loop in TypeScript with grouped-task delayed feedback.

## Hypothesis

A grouped delayed-reward curation policy yields better downstream task utility than immediate-only curation on the same frozen executor.

## Setup

- Executor: fixed deterministic task scorer.
- SkillRepo: markdown-like skill records.
- Streams: synthetic grouped tasks (`groupId`) with early and late tasks.
- Policies compared:
  - Baseline A: no curation (static repo)
  - Baseline B: immediate-only curation reward
  - Variant: composite grouped delayed reward

## Procedure

1. Initialize identical repos for all variants.
2. Run each variant over same grouped stream.
3. Record reward components and final task utility.
4. Compare transfer gain on late tasks.

## Acceptance criteria

- Variant shows positive `transfer_gain` versus Baseline B.
- No safety gate violations in accepted operations.
- Repo versions remain valid and bounded.

## Artifacts

- Operation logs (`accepted`, `rejected`, reasons).
- Reward breakdown by task and group.
- Repo version lineage.
- Final aggregate metrics table.
