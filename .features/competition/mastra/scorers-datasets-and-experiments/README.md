# Scorers Datasets And Experiments

- Harness: Mastra
- Sourced: 2026-05-01

## What it is
Mastra turns evaluation into a built-in feedback loop through scorers, datasets, experiments, and production trace review instead of leaving quality measurement to external notebooks or one-off scripts.

## Evidence
- Official docs: [Evals overview](https://mastra.ai/en/docs/evals/overview)
- Official blog: [Introducing Scorers in Mastra](https://mastra.ai/blog/mastra-scorers)
- Official site: [Mastra Cloud](https://mastra.ai/cloud)
- First-party details:
  - the evals docs expose off-the-shelf scorers, custom scorers, and examples like faithfulness, toxicity, keyword coverage, contextual recall, and LLM-as-a-judge
  - the scorers blog says scorers run asynchronously after an agent responds and support sampling so teams can balance quality coverage against cost
  - the cloud product page says teams can build regression sets from production traces, run experiments, compare versions, and score historical traces retroactively
  - the current cloud page positions scoring and experiments as part of normal operational iteration, not just offline benchmarking
- Latest development checkpoint:
  - Mastra's latest public positioning keeps pushing evaluation closer to production operations and team review loops

## Product signal
Mastra treats evals as part of the harness itself, which is increasingly important for teams that need to improve agents systematically rather than by anecdotal prompt tweaking.
