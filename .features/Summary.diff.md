# Summary Diff For Linear Feature Generation

Updated: 2026-04-30
Baseline: `.features/Summary.md` updated from the 2026-04-30 twelve-harness corpus.
Diff type: additive update after OpenAI Symphony research

## Net new normalized features

### Expanded: Parallel agent orchestration
- Why now: OpenAI Symphony reframes orchestration around the issue tracker itself, where each eligible Linear issue gets its own continuously managed agent run instead of requiring humans to juggle session tabs and terminals.
- Research delta:
  - the April 27, 2026 OpenAI announcement says every open task gets an agent and the system restarts agents that crash or stall
  - the spec requires bounded concurrency, issue eligibility checks, reconciliation, and blocker-aware dispatch
  - the orchestrator continues work until a workflow-defined handoff state is reached, not just until one prompt finishes

### Expanded: Git/PR-native execution
- Why now: Symphony raises the bar from plain diffs to proof-of-work review packets and merge shepherding.
- Research delta:
  - the repo README says agents return CI status, PR review feedback, complexity analysis, and walkthrough videos
  - the announcement says Symphony watches CI, rebases when needed, resolves conflicts, retries flaky checks, and shepherds work through the landing pipeline

### Added: Turn the issue tracker into the browser-agent control plane
- Why now: Symphony makes the project board itself the primary operator surface, which is a materially different UX from launching browser-agent jobs manually.
- Linear issue title:
  - `Use Linear as the browser-agent control plane`
- Suggested problem statement:
  - Browser-agent work is still launched and supervised session by session, which does not scale once a team wants multiple concurrent implementation runs across a backlog.
- One-shot instruction for an LLM:
  - Design and implement a tracker-native orchestration mode that polls eligible Linear issues, creates or reuses isolated browser-agent workspaces per issue, respects blocker dependencies and workflow-defined handoff states, restarts stalled runs, and exposes board-linked status back to operators.

### Added: Add a repo-owned workflow contract with live reload
- Why now: Symphony's `WORKFLOW.md` contract shows a clean way to version prompt policy, hooks, and runtime settings directly with the codebase.
- Linear issue title:
  - `Add live reloading workflow contracts for browser agents`
- Suggested problem statement:
  - Browser-agent runtime policy is still too fragmented across local config, prompts, and code, which makes it hard for teams to version, review, and safely update shared behavior.
- One-shot instruction for an LLM:
  - Build a repository-owned workflow contract file for browser agents with YAML front matter plus markdown prompt body, covering tracker integration, workspace hooks, concurrency, tool settings, and prompt policy, then implement strict validation, live reload, last-known-good fallback, and operator-visible error reporting.

### Added: Ship orchestration telemetry and operator APIs
- Why now: Symphony already treats dashboards and JSON debug endpoints as first-class operating tools for a long-running harness.
- Linear issue title:
  - `Expose browser-agent orchestration telemetry`
- Suggested problem statement:
  - Long-running browser-agent queues are hard to trust when operators cannot inspect live session state, retry queues, or issue-specific debugging details without digging through raw logs.
- One-shot instruction for an LLM:
  - Implement an operator telemetry surface for browser-agent orchestration with structured logs, a queue/session dashboard, issue-scoped debug views, and a read-mostly JSON API for current state plus manual refresh triggers.

### Added: Automate proof-of-work review packets
- Why now: Symphony treats review packets as a primary deliverable, not just an internal implementation detail.
- Linear issue title:
  - `Generate proof-of-work packets for browser-agent runs`
- Suggested problem statement:
  - Browser-agent changes still require humans to assemble validation evidence manually, which slows review and reduces trust in autonomous execution.
- One-shot instruction for an LLM:
  - Build a proof-of-work packet generator for browser-agent tasks that assembles CI status, validation output, diff summaries, screenshots or walkthrough media, and review notes into a structured handoff artifact ready for PR review or human approval.

### Expanded: External tool connectivity and actionability
- Why now: Symphony demonstrates a clean orchestrator boundary where tracker mutations live in agent tools rather than in scheduler business logic.
- Research delta:
  - the spec defines `linear_graphql` as the current standardized optional client-side tool
  - ticket comments, state changes, and PR metadata are meant to stay in the agent toolchain while the orchestrator remains a scheduler/runner

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Use Linear as the browser-agent control plane`
2. `Add live reloading workflow contracts for browser agents`
3. `Expose browser-agent orchestration telemetry`
4. `Generate proof-of-work packets for browser-agent runs`
