# Summary Diff For Linear Feature Generation

Updated: 2026-05-01
Baseline: `.features/Summary.md` updated from the 2026-05-01 sixteen-harness corpus.
Diff type: additive update after Cursor research

## Net new normalized features

### Added: Durable interactive agent artifacts
- Why now: Cursor's canvases make interactive agent output part of the working surface, not only part of the transcript.
- Research delta:
  - the April 15, 2026 Cursor changelog says agents can create interactive canvases containing dashboards, custom interfaces, charts, diagrams, diffs, and to-do lists
  - those canvases live as durable side-panel artifacts alongside terminal, browser, and source control
  - Cursor's MCP Apps release reinforces the same direction by rendering richer interactive app UIs inside the agent surface

### Expanded: Embeddable agent runtimes and protocol surfaces
- Why now: Cursor just made its internal harness available as a public SDK with a more explicit run lifecycle API.
- Research delta:
  - the April 29, 2026 SDK launch exposes the same runtime used by Cursor desktop, CLI, and web
  - the updated Cloud Agents API is run-scoped, supports SSE streaming and reconnect, and adds archive and delete lifecycle controls
  - Cursor explicitly positions this for CI, automations, internal platforms, and embedded product experiences

### Expanded: Parallel agent orchestration
- Why now: Cursor's April 24, 2026 multitask release makes async subagents, worktrees, and multi-root workspaces a cleaner supervisor workflow than the current summary captured.
- Research delta:
  - `/multitask` now breaks larger tasks into async subagents instead of merely queueing them
  - worktrees in the Agents Window support isolated background runs across branches with one-click foreground handoff
  - multi-root workspaces let one agent session span frontend, backend, and shared libraries across folders or repos

### Added: Expose browser-agent via SDK and durable run API
- Why now: `agent-browser` still behaves mostly like an app-local UI surface, while Cursor is now exposing its harness as a programmable platform.
- Linear issue title:
  - `Expose browser-agent runs through a typed SDK`
- Suggested problem statement:
  - `agent-browser` has no clean public runtime for other tools, automations, or products to launch durable runs, stream status, reconnect later, and manage lifecycle state without driving the UI indirectly.
- One-shot instruction for an LLM:
  - Design and implement a typed `agent-browser` SDK and durable run API that can launch local or remote browser-agent sessions, stream structured events, support reconnect and cancellation, expose explicit run lifecycle controls, and let other internal tools embed the harness without screen-scraping the app.

### Added: Add multitask subagents with worktree-aware branch isolation
- Why now: Cursor shows a concrete path for parallel subagents that can each work in their own isolated branch context and then be compared or foregrounded deliberately.
- Linear issue title:
  - `Add multitask subagents and branch isolation`
- Suggested problem statement:
  - `agent-browser` still centers one active run at a time, which makes larger tasks slow to supervise and makes parallel branch-safe experimentation awkward.
- One-shot instruction for an LLM:
  - Implement a multitask mode for `agent-browser` that decomposes larger work into async subagents, launches each subagent in an isolated branch or worktree context, shows side-by-side status and output comparison, and allows one-click promotion of a chosen branch back into the primary foreground workflow.

### Added: Add durable interactive canvases for agent runs
- Why now: Cursor canvases suggest that planning, review, and debugging benefit from interactive artifacts that outlive the chat turn.
- Linear issue title:
  - `Add durable agent canvases`
- Suggested problem statement:
  - `agent-browser` can show transcript, browser, and code state, but it cannot yet preserve agent-authored dashboards, diagrams, checklists, or review panels as durable workspace artifacts.
- One-shot instruction for an LLM:
  - Implement a canvas artifact system for `agent-browser` where agents can create and update persistent dashboards, diagrams, checklists, and review panels that live beside transcript, terminal, browser, and diff views, with explicit artifact IDs, revision history, and safe follow-up updates.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Expose browser-agent runs through a typed SDK`
2. `Add multitask subagents and branch isolation`
3. `Add durable agent canvases`
