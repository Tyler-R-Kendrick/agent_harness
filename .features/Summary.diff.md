# Summary Diff For Linear Feature Generation

Updated: 2026-06-04
Baseline: `.features/Summary.md` refreshed through the 2026-06-03 ChatGPT corpus.
Diff type: additive updates after the 2026-06-04 DeerFlow refresh

## Net new normalized features

### Added: Visible plan-mode task lists with durable artifact and usage context
- Why now: the refreshed DeerFlow corpus adds a more explicit application-layer supervision surface for long-running work instead of leaving planning, artifacts, and usage buried in raw transcripts or separate logs.
- Research delta:
  - DeerFlow Workspace Usage now documents an input-bar Plan Mode that enables todo-list middleware and keeps a visible task list updated in real time
  - the same workspace surfaces inline tool calls, tool results, thinking blocks, and subagent output during the active run
  - generated files are promoted into a dedicated artifacts panel with previews and downloads instead of being treated as hidden side effects
  - DeerFlow distinguishes a persisted conversation-level token ledger from optional per-turn or debug usage summaries, which gives the operator both durable and in-context usage views
  - backend docs tie the UI back to an explicit runtime contract through `is_plan_mode` and the `write_todos` tool, so the visible plan is part of the execution model rather than a decorative frontend checklist

## Expanded normalized features

### Expanded: Parallel agent orchestration
- Why now: the refreshed DeerFlow subagent docs make the worker topology more explicit and more open than the older local slice captured.
- Research delta:
  - DeerFlow now documents built-in `general-purpose` and `bash` subagents with independent timeout and max-turn settings
  - it exposes `max_concurrent_subagents` as a first-class limit instead of leaving parallelism implicit
  - custom DeerFlow agents created in the app can themselves be invoked as subagents
  - ACP-wrapped external agents such as Claude Code and Codex are now documented as first-party examples of delegated workers

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: the refreshed DeerFlow skills docs now show runtime governance and optional agent-managed skill creation rather than only static skill packaging.
- Research delta:
  - DeerFlow can enable or disable skills live through `extensions_config.json`, the App UI, or Gateway API endpoints without a restart
  - skill content is security-scanned before loading
  - custom agents can be limited to named skill subsets
  - optional `skill_evolution` allows trusted runs to create or improve skills in `skills/custom/`

## Linear-ready feature payloads

### Proposed Linear feature: Add visible plan mode with real-time task tracking and artifact context
- Linear issue title:
  - `Add visible plan mode with real-time task tracking and artifact context`
- Suggested problem statement:
  - `agent-browser` already streams responses and can surface tool activity, but it still lacks a first-class plan-mode contract that makes long tasks inspectable while they are running. Competitors are starting to show an explicit live task list, a stable artifact shelf, and durable run-level usage context inside the main workspace rather than forcing users to infer progress from transcript fragments. Without that execution view, users have to reconstruct the plan manually, hunt through the thread for intermediate outputs, and lose confidence about where time and tokens are going during long runs. The product needs a visible plan-mode workspace that turns long-horizon execution into something users can supervise, steer, and audit in one place.`
- One-shot instruction for an LLM:
  - Implement visible plan mode for `agent-browser`: add a per-run plan-mode toggle that enables task-list middleware, give the runtime a structured todo tool or equivalent state contract with one task `in_progress` at a time, render the live task list directly in the main workspace with explicit `pending`, `in_progress`, and `completed` states, stream tool and subagent events inline with the active run, promote generated files into a dedicated artifacts panel with previews and download affordances, and show both durable run-level usage totals and the currently visible per-turn usage context so operators can supervise long-running work without leaving the thread.
