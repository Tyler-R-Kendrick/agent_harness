# Experiment 01 — TypeScript 12-Metric Harness Scaffold

## Hypothesis

A typed, deterministic scoring harness can convert raw run telemetry into a production gate decision with interpretable failure reasons.

## Setup

- Language: TypeScript
- Input: synthetic run cases for deterministic validation
- Output: structured report containing per-metric scores, pillar scores, overall score, and gate results

## Procedure

1. Define typed telemetry and score schemas.
2. Implement normalizers for quality and lower-is-better metrics.
3. Compute all 12 metrics at case level and aggregate means.
4. Apply configurable gates.
5. Produce release decision and blocking reasons.

## Acceptance criteria

- Generates a report with all 12 metrics and 4 pillar scores.
- Produces deterministic gate pass/fail outcomes.
- Returns human-readable blocking reasons for failed gates.

## Artifacts

- `experiment-01-twelve-metric-harness.ts`
