# Experiment 01 — Deterministic Operator Orchestrator Scaffold

## Hypothesis

A deterministic operator scheduler with bounded micro-batching can reduce orchestration variance while preserving output order equivalence versus a naive sequential runner.

## Setup

- Synthetic workload with stages: preprocess -> embed -> retrieve -> reason.
- Baseline: sequential per-record processing.
- Variant: DOPO batch scheduler (`batchSize=8`, `flushEvery=5ms`).

## Procedure

1. Generate a fixed seed dataset of 1,000 requests.
2. Run baseline and record ordering hash + stage timings.
3. Run DOPO variant with same seed and inputs.
4. Assert ordering equivalence and compare orchestration overhead metrics.

## Acceptance criteria

- Output ordering hash matches baseline for deterministic operators.
- Orchestration p95 variance is lower than baseline.
- No contract violations over full run.

## Artifacts

- Execution trace log
- Ordering hashes
- Batch statistics table
