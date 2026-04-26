# Summary Diff For Linear Feature Generation

Updated: 2026-04-26
Baseline: `.features/Summary.md` updated from the 2026-04-24 eight-harness corpus.
Diff type: additive update after DeerFlow research

## Net new normalized features

### Expanded: Parallel agent orchestration
- Why now: DeerFlow reinforces that visible planning modes plus scoped parallel sub-agents are becoming a default harness expectation, not a premium edge case.
- Research delta:
  - DeerFlow 2.0 exposes planning and sub-tasking as headline product capability and documents an `ultra` mode for sub-agent execution.

### Added: Parallel agent orchestration
- Why now: this is the clearest product trend across coding and browser-oriented harnesses.
- Linear issue title:
  - `Orchestrate parallel browser agents in one workspace`
- Suggested problem statement:
  - Users can run one browser-oriented task at a time, but competing harnesses increasingly support multiple isolated agents, subagents, or routed workspaces.
- One-shot instruction for an LLM:
  - Design and implement a workspace feature that launches multiple isolated agent runs against a shared project, shows per-run status, preserves separate context, lets users compare outputs, and supports pause, resume, cancel, and merge-ready handoff.

### Added: Layered memory and guidance
- Linear issue title:
  - `Add layered memory with explicit scopes`
- Suggested problem statement:
  - Users repeatedly restate repo conventions, browser constraints, and workflow preferences because memory is either absent or opaque.
- One-shot instruction for an LLM:
  - Implement memory scopes for user, project, workspace, and run; support import/edit/disable, show provenance, and expose memory in a simple inspector UI that explains which guidance affected the current run.

### Added: Skills and reusable browser workflows
- Linear issue title:
  - `Package repeatable browser workflows as skills`
- Suggested problem statement:
  - Powerful workflows are trapped in long prompts instead of reusable, testable packages.
- One-shot instruction for an LLM:
  - Create a skill format for browser workflows containing metadata, instructions, permissions, assets, and scripts; add discovery/install/use flows and task-time skill suggestions.

### Added: Scheduled automations with inbox results
- Linear issue title:
  - `Run browser automations on schedules`
- Suggested problem statement:
  - Users need recurring checks, audits, and verification runs without manually re-triggering the harness.
- One-shot instruction for an LLM:
  - Add scheduled one-off and recurring automations with execution history, last-run evidence, retry controls, notification routing, and an inbox queue for results requiring review.

### Added: Browser evidence plus code verification loop
- Linear issue title:
  - `Tie browser evidence to code and diff review`
- Suggested problem statement:
  - Browser automation becomes much more trustworthy when screenshots, console logs, network traces, and DOM evidence are attached to the code changes they validate.
- One-shot instruction for an LLM:
  - Build a verification flow that captures screenshots, console/network state, and structured browser assertions, associates them with code changes and diffs, and shows pass/fail evidence before PR handoff.

### Added: Shared team agents and governance
- Linear issue title:
  - `Publish shared workspace agents with governance`
- Suggested problem statement:
  - Teams need reusable browser-capable agents with ownership, permissions, and visibility, not just personal prompts.
- One-shot instruction for an LLM:
  - Implement shared agents that can be published, versioned, permissioned, and discovered by a team; include RBAC, audit visibility, and usage analytics.

### Added: Chat-channel agent ingress
- Why now: DeerFlow turns chat apps into a first-class control plane for starting work, checking status, and accessing memory, which is broader than simple notification delivery.
- Linear issue title:
  - `Accept browser-agent tasks from chat channels`
- Suggested problem statement:
  - Competing harnesses increasingly meet users in messaging surfaces, but `agent-browser` still assumes task intake begins inside its primary UI.
- One-shot instruction for an LLM:
  - Design and implement chat-channel ingress for browser agents with per-channel auth, conversation-to-run mapping, slash-style status and memory commands, file attachment handoff, and safe routing into existing runs without duplicating history.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended first Linear batch

1. `Orchestrate parallel browser agents in one workspace`
2. `Add layered memory with explicit scopes`
3. `Run browser automations on schedules`
4. `Package repeatable browser workflows as skills`
5. `Tie browser evidence to code and diff review`
6. `Accept browser-agent tasks from chat channels`
