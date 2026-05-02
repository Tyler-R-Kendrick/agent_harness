# Plan Mode And `PLAN.md`

- Harness: OpenHands
- Sourced: 2026-05-02

## What it is
OpenHands added a Planning Mode beta that separates planning from implementation. The planning agent produces a structured `PLAN.md` inside the workspace, asks clarifying questions when the request is underspecified, and then hands that artifact to Code Mode for execution.

## Evidence
- Official changelog: [OpenHands Product Update - March 2026](https://openhands.dev/blog/openhands-product-update---march-2026)
- First-party details:
  - OpenHands says users can switch between Plan Mode and Code Mode.
  - Planning Mode generates a structured `PLAN.md` file in the workspace.
  - When prompts are vague, the planning agent asks follow-up questions to elicit requirements before writing the plan.
- Latest development checkpoint:
  - the March 6, 2026 product update introduced Planning Mode as a new OpenHands Cloud beta and showed screenshots on the source page

## Product signal
OpenHands is pushing planning into a durable workspace artifact instead of leaving it as transient chat output. That makes plan review, handoff, and later verification much easier.
