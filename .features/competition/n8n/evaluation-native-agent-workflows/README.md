# Evaluation-Native Agent Workflows

- Harness: n8n
- Sourced: 2026-05-10

## What it is
n8n includes built-in evaluation workflows for testing agent systems before and after deployment with datasets, outputs, and metrics.

## Evidence
- Official docs: [Evaluations overview](https://docs.n8n.io/advanced-ai/evaluations/overview/)
- Official docs: [Light evaluations](https://docs.n8n.io/advanced-ai/evaluations/light-evaluations/)
- Official docs: [Metric-based evaluations](https://docs.n8n.io/advanced-ai/evaluations/metric-based-evaluations/)
- First-party details:
  - n8n splits evaluations into light pre-deployment evaluation and metric-based post-deployment evaluation
  - both modes use datasets so workflow behavior can be checked against edge cases and expected outputs
  - n8n explicitly frames evaluation as necessary for comparing prompts and models and for catching regressions from production learnings
  - metric-based evaluation is positioned as the next step once eyeballing a handful of examples stops scaling
- Latest development checkpoint:
  - the current evaluation docs treat evals as a built-in production workflow discipline, not as external lab tooling

## Product signal
n8n is one of the clearer examples of a harness where evaluation is part of the authoring surface instead of an optional afterthought.
