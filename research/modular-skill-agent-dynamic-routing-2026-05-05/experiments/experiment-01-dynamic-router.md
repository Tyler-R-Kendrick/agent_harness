# Experiment 01 — Deterministic Dynamic Skill Routing

## Objective

Demonstrate modular skill registration, deterministic routing, composite execution, and telemetry in our TypeScript stack.

## Hypothesis

A deterministic scored router with composite skill support will outperform static single-tool execution on mixed-task suites.

## Setup

- Runtime: TypeScript-only simulation.
- Skills: calculator, summarizer, translator, and composite research-report.
- Baselines:
  1. Static baseline (`summarizer` for every task).
  2. Dynamic router baseline (DSR-CE).

## Procedure

1. Build synthetic task set with intent labels.
2. Execute static baseline and capture success/latency.
3. Execute DSR-CE and capture success/latency.
4. Compare route-accuracy and success metrics.

## Acceptance criteria

- DSR-CE route-accuracy >= 90% on synthetic suite.
- DSR-CE success rate > static baseline.
- Fallback rate <= 15%.

## Artifacts

- Routing decision logs.
- Aggregate metrics summary.
- Skill-level latency table.
