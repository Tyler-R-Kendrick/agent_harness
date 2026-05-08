# Summary Diff For Linear Feature Generation

Updated: 2026-05-08
Baseline: `.features/Summary.md` refreshed from the 2026-05-07 twenty-three-harness corpus.
Diff type: additive update after Roomote research

## Net new normalized features

### Added: Enterprise model governance and spend-aware operations
- Why now: Cursor is showing that once harnesses span local chats, cloud agents, automations, and reviewer agents, admins need policy and budget controls that work across all of them.
- Research delta:
  - Cursor's May 4, 2026 changelog adds provider-level and model-level allow or block lists
  - admins can default-block newly released providers or model versions
  - soft spend limits now trigger automatic alerts at 50%, 80%, and 100%
  - usage analytics can now be broken down by user and by surface, including clients, Cloud Agents, automations, Bugbot, and Security Review

### Added: Always-on specialist security review agents
- Why now: Cursor has turned security-specific reviewer agents into a first-class part of the harness instead of leaving this work to generic coding agents or separate security tools.
- Research delta:
  - Cursor Security Review adds `Security Reviewer` for inline PR review and `Vulnerability Scanner` for scheduled repo scans
  - the reviewer explicitly checks auth regressions, privacy/data handling, prompt injection, and unsafe agent auto-approvals
  - findings include inline severity and remediation guidance
  - teams can wire in existing SAST, SCA, and secret scanners via MCP and send scan updates to Slack

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: Cursor is tightening the governance side of its plugin platform, not only the rendering side.
- Research delta:
  - team marketplaces can now be created without first connecting a repository
  - first-party plugins now support explicit `Default Off`, `Default On`, and `Required` install behavior
  - the governed package surface spans MCP servers, skills, subagents, rules, and hooks

### Added: Add security review agents and scheduled vulnerability scans
- Why now: `agent-browser` already has review and automation ambitions, but it does not yet have specialized continuous security agents that can review diffs and run scheduled repo scans inside the same harness and governance layer.
- Linear issue title:
  - `Add security review agents and scheduled vulnerability scans`
- Suggested problem statement:
  - `agent-browser` can run browser-capable agents and validation flows, but it lacks specialized security reviewers that can continuously inspect pull requests, run scheduled vulnerability scans, and surface severity-tagged findings in the same operational workflow.
- One-shot instruction for an LLM:
  - Implement specialized security review agents for `agent-browser` that can inspect pull-request diffs and scheduled repository state, emit inline severity-tagged findings with remediation guidance, integrate existing security tools through the harness tool layer, and deliver scheduled scan updates through the same automation and review surfaces already used for browser-agent work.

### Added: Runtime plugin layer with tool-call interception
- Why now: Kilo Code is treating runtime extension as an execution-time policy and behavior layer, not just as a prompt or tool manifest.
- Research delta:
  - Kilo plugins can add custom tools and providers
  - plugins can intercept tool calls, rewrite arguments or outputs, and block dangerous operations
  - plugins can subscribe to session, permission, message, file-change, and diagnostics events
  - plugins can inject shell environment variables and customize compaction behavior

### Added: AI adoption scoring for engineering organizations
- Why now: Kilo is measuring AI workflow maturity explicitly, which goes beyond spend controls and starts giving engineering leaders a management surface for adoption.
- Research delta:
  - Kilo analytics break usage down by day, model, project, and user
  - the AI Adoption Dashboard exposes a 0-100 score
  - the score is decomposed into frequency, depth, and coverage
  - the dashboard is aimed at team leads and engineering managers tracking organizational AI maturity

### Added: Add a runtime plugin layer with tool-call interception and event hooks
- Why now: `agent-browser` already has tools, skills, and agent routing, but it lacks a first-class extension runtime where product teams can intercept actions, subscribe to agent events, and enforce policy without forking the core harness.
- Linear issue title:
  - `Add a runtime plugin layer with tool-call interception and event hooks`
- Suggested problem statement:
  - `agent-browser` supports built-in tools and repo-owned instructions, but it does not yet provide a reusable plugin runtime that can register new tools and providers, observe agent lifecycle events, or intercept risky tool calls at execution time.
- One-shot instruction for an LLM:
  - Implement a browser-agent plugin runtime for `agent-browser` that can load repo or user-installed plugins, register tools and model or auth providers, subscribe to structured agent lifecycle events, intercept or veto tool calls with auditable rationale, and expose a stable configuration surface that works across interactive sessions, automations, and review flows.

### Added: Closed-loop PR feedback learning and autonomous refinement
- Why now: Roomote is framing reviewer feedback as an input to future work quality, not just as cleanup on the current PR.
- Research delta:
  - Roomote says it self-improves from PR feedback and keeps refining in the background with approval
  - the product also claims built-in review loops that catch issues early and auto-fix them before human reviewers spend time on low-signal cleanup
  - Roomote's shared task UI pairs transcript, diff, logs, previews, artifacts, and task info, which gives the system a natural place to collect reusable reviewer signals instead of losing them in isolated IDE chats

### Added: Add reviewer-feedback learning loops that refine future agent runs
- Why now: `agent-browser` already has repo-owned instructions and review ambitions, but it does not yet convert accepted reviewer feedback into durable, inspectable guidance that improves later runs.
- Linear issue title:
  - `Add reviewer-feedback learning loops that refine future agent runs`
- Suggested problem statement:
  - `agent-browser` can produce diffs, browser evidence, and review artifacts, but reviewer corrections are still mostly trapped inside individual PRs instead of being promoted into reusable rules, heuristics, or self-review checks for future sessions.
- One-shot instruction for an LLM:
  - Implement reviewer-feedback learning for `agent-browser` so accepted and rejected PR comments can be captured as structured lessons, reviewed and approved by operators, replayed during planning and self-review, versioned per workspace or project, and safely disabled or expired when they become stale or overfit.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Add reviewer-feedback learning loops that refine future agent runs`
