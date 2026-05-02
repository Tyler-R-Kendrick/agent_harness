# Trajectory-Level Verifier And Production Critics

- Harness: OpenHands
- Sourced: 2026-05-02

## What it is
OpenHands is building a layered verification stack for coding agents and has already introduced a fast critic model that scores an agent trajectory during the run to decide whether to continue, stop, refine, or compare attempts.

## Evidence
- Official blog: [Learning to Verify AI-Generated Code](https://openhands.dev/blog/20260305-learning-to-verify-ai-generated-code)
- First-party details:
  - OpenHands describes verification as a layered stack that helps agents fail fast and produce changes humans can trust and merge
  - the first layer is a trajectory-level verifier implemented as a small, fast critic model
  - OpenHands says the critic can decide whether to continue, stop, or refine and can pick among multiple attempts
  - the company says benchmark-trained critics translated poorly to production, so this critic is trained on production signals such as PR merge and code survival
- Latest development checkpoint:
  - the March 5, 2026 post positions runtime verification, not raw generation, as the current bottleneck for trustworthy coding agents and includes a scoring diagram on the source page

## Product signal
This is one of the clearest signs that serious harnesses are moving toward online quality control inside the run, not only offline tests after the run is over.
