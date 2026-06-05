# Summary Diff For Linear Feature Generation

Updated: 2026-06-05
Baseline: `.features/Summary.md` refreshed through the 2026-06-04 DeerFlow corpus.
Diff type: additive updates after the 2026-06-05 Claude Code refresh

## Net new normalized features

### Added: Condition-bound autonomous goals with explicit success evaluation
- Why now: the refreshed Claude Code corpus adds a first-party goal contract where the runtime owns the completion condition and decides whether another turn is required.
- Research delta:
  - Claude Code now documents `/goal` as a completion condition that keeps a session working across turns until the condition holds
  - after each turn, a small fast model evaluates whether the goal condition is satisfied and triggers another turn when it is not
  - Anthropic explicitly frames the feature around verifiable end states such as passing tests, satisfying acceptance criteria, reducing file size budgets, or clearing labeled backlogs
  - the same goal contract is documented across interactive sessions, non-interactive `-p` runs, and Remote Control
  - the public docs turn long-running autonomy from an implicit loop into an inspectable success-criteria primitive

## Expanded normalized features

### Expanded: Parallel agent orchestration
- Why now: the refreshed Claude Code corpus now distinguishes multiple parallelism modes instead of flattening everything into subagents.
- Research delta:
  - Claude Code now documents `agent teams` as a separate lead-worker orchestration model with direct teammate interaction
  - the docs explicitly contrast teams with subagents, which stay inside one session and only report back to the main agent
  - team members run in separate context windows and can message one another directly
  - this makes the product’s parallel execution model more differentiated: subagents, agent teams, agent view, and worktree-backed sessions are separate choices with different tradeoffs

### Expanded: Background session supervisor views with peek-and-reply control
- Why now: the refreshed Claude Code agent-view docs are more explicit about the control-plane mechanics than the older local slice captured.
- Research delta:
  - Agent View now documents grouped `Needs input`, `Working`, and `Completed` states instead of only a generic background-session list
  - users can peek the latest output, reply from the peek panel, and send an existing session into the background with `/bg`
  - `--cwd` can scope the session list to one project
  - settings, plugins, MCP servers, and added directories can be passed through to every session dispatched from the supervisor surface

## Linear-ready feature payloads

### Proposed Linear feature: Add condition-bound goals with explicit success criteria and auto-continue
- Linear issue title:
  - `Add condition-bound goals with explicit success criteria and auto-continue`
- Suggested problem statement:
  - `agent-browser` can already carry out multi-step work, but it still treats long tasks as open-ended chat turns unless the user manually nudges the run forward. Competitors are starting to expose a stronger contract: the operator states a completion condition, the runtime evaluates whether it has been met after each turn, and the session keeps going automatically until the condition is satisfied or blocked. Without that contract, users have to restate the objective, decide manually whether more turns are needed, and infer whether the run actually reached the intended end state. The product needs goal-bound autonomy with explicit success evaluation so long-running work can continue safely and stop for the right reason.`
- One-shot instruction for an LLM:
  - Implement goal-bound autonomy for `agent-browser`: let a user set a durable completion condition on a run, store that goal as structured run state, evaluate the condition after each turn with a lightweight success checker, automatically continue into another turn when the condition is still unmet, stop and clear the goal when it passes, and show the goal text plus the latest evaluation outcome in the app so interactive, background, and remote sessions can keep working toward a verifiable end state without the user restating the objective every step.
