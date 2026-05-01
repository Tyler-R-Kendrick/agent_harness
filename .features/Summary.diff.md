# Summary Diff For Linear Feature Generation

Updated: 2026-05-01
Baseline: `.features/Summary.md` updated from the 2026-05-01 seventeen-harness corpus.
Diff type: additive update after Mastra research

## Net new normalized features

### Added: Reusable harness cores for agent-powered apps
- Why now: Mastra just productized the harness plumbing itself inside `@mastra/core`, which makes the runtime layer feel like a reusable platform surface instead of a one-off app implementation detail.
- Research delta:
  - the February 19, 2026 Mastra changelog introduces a generic Core Harness that bundles modes, state management, built-in tools, subagent support, memory integration, model discovery, tool approval, and thread lifecycle handling
  - Mastra says this exists to replace the "agent app plumbing" teams usually rebuild themselves
  - MastraCode was migrated onto the same reusable Harness, which suggests the runtime is product-grade and not just a docs abstraction

### Added: Evaluation-native observability and live scoring
- Why now: Mastra is making runtime quality measurement part of the same surface as tracing and operator debugging instead of keeping evals isolated in offline tooling.
- Research delta:
  - Mastra Observability logs prompts, completions, token usage, latency, decision paths, tool calls, and memory operations for every run
  - Mastra Scorers can run live against agents and workflow steps, run in CI/CD, and be managed in Studio
  - the February 13, 2026 release added first-class Datasets and Experiments, which turns quality tracking into a maintained runtime asset

### Expanded: Browser use and computer control
- Why now: Mastra's browser support shows a cleaner pattern for browser tooling as a provider-backed primitive with live supervision rather than a hardcoded tool bundle.
- Research delta:
  - the April 24, 2026 browser announcement says attached agents can navigate, click, fill forms, and extract structured data
  - Studio streams each browser interaction live and lets the operator step in or stop the run at any point
  - Mastra supports both local browser providers and managed services like Browserbase, starting with Stagehand and AgentBrowser

### Added: Extract a reusable browser-agent harness core
- Why now: `agent-browser` still couples too much runtime logic to the app shell, while Mastra shows that the harness itself can be a reusable product primitive.
- Linear issue title:
  - `Extract a reusable browser-agent harness core`
- Suggested problem statement:
  - `agent-browser` still mixes orchestration concerns directly into the product surface, which makes it harder to reuse the same modes, approvals, memory hooks, and subagent lifecycle across desktop UI, automations, and future embedded surfaces.
- One-shot instruction for an LLM:
  - Extract a reusable `agent-browser` harness core that owns mode and state management, thread lifecycle, plan and approval tools, memory integration, subagent orchestration, and event streaming, then have the current app shell consume that core instead of implementing orchestration ad hoc.

### Added: Add evaluation-native observability and live scorers
- Why now: `agent-browser` needs quality measurement that lives beside runtime traces, not only post hoc bug reports and manual transcript review.
- Linear issue title:
  - `Add evaluation-native observability and live scorers`
- Suggested problem statement:
  - `agent-browser` can show activity and logs, but it still lacks a first-class way to score runs, compare quality over time, and inspect agent performance using the same operational surface that already holds runtime evidence.
- One-shot instruction for an LLM:
  - Implement evaluation-native observability for `agent-browser` with structured traces, live scorer hooks on browser and chat runs, dataset and experiment support for regressions, and dashboards that connect quality scores to run artifacts, transcripts, and tool trajectories.

### Added: Add versioned workspace skills and least-privilege policies
- Why now: Mastra is treating skills and workspace permissions like durable governed assets, while `agent-browser` still has coarse-grained policy seams and weak lifecycle management for reusable workflow assets.
- Linear issue title:
  - `Add versioned workspace skills and least-privilege policies`
- Suggested problem statement:
  - `agent-browser` skills and workspace access rules are not yet managed as versioned, inspectable, publishable assets with clear least-privilege boundaries, which makes reuse and governance harder than it should be.
- One-shot instruction for an LLM:
  - Design and implement versioned workspace skill packages and least-privilege workspace policies for `agent-browser`, including skill discovery metadata, draft-to-publish lifecycle, per-skill tool and path scopes, explicit allowlisted external paths, and searchable workspace helpers such as regex grep that respect those boundaries.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Extract a reusable browser-agent harness core`
2. `Add evaluation-native observability and live scorers`
3. `Add versioned workspace skills and least-privilege policies`
