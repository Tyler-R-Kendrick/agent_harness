# Summary Diff For Linear Feature Generation

Updated: 2026-05-02
Baseline: `.features/Summary.md` updated from the 2026-05-01 eighteen-harness corpus.
Diff type: additive update after OpenHands research

## Net new normalized features

### Added: Verification-native critic stacks and adaptive retries
- Why now: OpenHands is explicitly moving verification into the run itself with a fast trajectory critic, which is a stronger answer to agent drift than waiting for only end-of-run tests or human review.
- Research delta:
  - the March 5, 2026 OpenHands verification post describes a layered verification stack for coding agents
  - the first layer is a trajectory-level verifier implemented as a small, fast critic model
  - OpenHands says the critic can decide whether to continue, stop, refine, or choose among multiple attempts
  - the same post says critics trained only on benchmark-style traces translated poorly to production, so OpenHands trains on production signals such as PR merge and code survival

### Added: Benchmark-informed model routing and task-aware model choice
- Why now: OpenHands is turning model selection into a product surface with the OpenHands Index instead of leaving users to guess which model should plan, implement, or review a task.
- Research delta:
  - the January 29, 2026 OpenHands Index launch frames the benchmark as broad-coverage and continually updated
  - it scores models across issue resolution, greenfield apps, frontend work, software testing, and information gathering
  - OpenHands explicitly argues that model-agnostic harnesses should switch models across planning, implementation, and review/testing depending on priorities and cost/runtime constraints

### Expanded: Scheduled automations and background execution
- Why now: OpenHands is making automation runs look like first-class conversations rather than detached cron jobs.
- Research delta:
  - OpenHands Automations beta runs full conversations on a schedule in fresh sandboxes
  - each run can reuse configured integrations and stored secrets, then remain available for later review or follow-up continuation
  - the docs also surface plugin-based automations and event-based automations alongside scheduled ones

### Expanded: Git/PR-native execution
- Why now: OpenHands is showing a strong repo-native feedback loop where issue labels and review comments directly drive the next agent attempt.
- Research delta:
  - the GitHub Action docs use `fix-me` labels and `@openhands-agent` comments as trigger surfaces
  - follow-up can happen through top-level comments, inline review comments, or PR thread feedback
  - OpenHands distinguishes full-issue resolution from narrower comment-scoped requests

### Added: Add trajectory critics and adaptive retry control
- Why now: `agent-browser` still relies heavily on downstream validation and human inspection, while OpenHands shows a viable path for cheap in-run scoring that can stop weak attempts earlier.
- Linear issue title:
  - `Add trajectory critics and adaptive retry control`
- Suggested problem statement:
  - `agent-browser` can run tools, tests, and browser actions, but it still lacks a lightweight runtime critic that scores the trajectory itself and uses that score to decide whether to continue, stop, retry, branch, or request human intervention before a low-confidence run burns more time and tokens.
- One-shot instruction for an LLM:
  - Implement a trajectory-critic layer for `agent-browser` that scores conversation and tool traces during execution, records structured reasons for confidence or concern, and uses configurable thresholds to continue, stop, retry, branch into an alternative attempt, or escalate for human review.

### Added: Add benchmark-informed model routing for browser-agent tasks
- Why now: `agent-browser` has growing multi-model pressure, but it still lacks a first-class way to recommend or route models differently for planning, execution, verification, and research.
- Linear issue title:
  - `Add benchmark-informed model routing for browser-agent tasks`
- Suggested problem statement:
  - `agent-browser` does not yet maintain durable task-class evidence about which models perform best for planning, browser execution, verification, or follow-up analysis, so model choice remains too manual and anecdotal.
- One-shot instruction for an LLM:
  - Build benchmark-informed model routing for `agent-browser` by defining task classes, collecting repeatable evaluations with cost and latency metadata, surfacing recommendation logic in the UI and runtime, and allowing workflows to pin or auto-select different models for planning, browser action, verification, and review.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Add trajectory critics and adaptive retry control`
2. `Add benchmark-informed model routing for browser-agent tasks`
