# Experiment 01 — Rubric-Guided Stage Loop Scaffold

## Objective

Demonstrate a runnable stage-based loop that uses rubric scoring and reflection updates to influence subsequent attempts.

## Hypothesis

A stage-scored + reflection-updated runtime improves aggregate trajectory credit compared to a static stage policy.

## Setup

- Environment: deterministic mock research task runner.
- Baseline: fixed stage guidance, no reflection update.
- Variant: RGSR scaffold with reflection updates every attempt.
- Runs: 20 tasks with fixed seeds.

## Procedure

1. Run baseline stage loop over fixed task set.
2. Run RGSR loop over same task set.
3. Collect stage scores, total credit, and failure motifs.
4. Compare median total credit and variance.

## Acceptance criteria

- >=8% median total-credit improvement over baseline, or
- equal median with lower p75-p25 variance.

## Artifacts to capture

- Per-task rubric definitions.
- Stage traces and judge outputs.
- Reflection profile versions.
- Aggregate metrics summary.

## Implementation target

- Use strongly typed TypeScript interfaces.
- Keep stage definitions deterministic and auditable.
- Preserve explicit validator gates for reflection updates.
