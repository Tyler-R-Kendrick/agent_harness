# Live Evals, Scorers, And Studio

- Harness: Mastra
- Sourced: 2026-05-01

## What it is
Mastra includes first-class evaluation primitives so teams can run live scorers against agent and workflow output, manage those scorers in Studio, and turn quality monitoring into part of normal runtime operations.

## Evidence
- Official docs: [Scorers Overview](https://mastra.ai/docs/evals/overview)
- Official changelog: [Mastra Changelog 2026-02-13](https://mastra.ai/blog/changelog-2026-02-13)
- First-party details:
  - Mastra says scorers can run in the cloud or as part of CI/CD pipelines.
  - Live evaluations score outputs asynchronously while agents and workflows operate, instead of relying only on manual batch evals.
  - Scorers can be attached directly to agents or to individual workflow steps.
  - Studio can register scorers, score traces interactively, review scores, and run experiments.
  - the February 13, 2026 release added first-class Datasets and Experiments with versioned evaluation items.
- Latest development checkpoint:
  - Mastra continues to treat evaluation as a shipped product surface that spans runtime, Studio, and CI, not just a docs-side best practice

## Product signal
Mastra is collapsing the gap between observability and evals. That is a meaningful trend for harnesses because it moves "is the agent good?" from a periodic research exercise into an always-on operational loop.
