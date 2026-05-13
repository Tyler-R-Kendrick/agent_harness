# Summary Diff For Linear Feature Generation

Updated: 2026-05-13
Baseline: `.features/Summary.md` refreshed from the 2026-05-12 twenty-eight-harness corpus.
Diff type: additive update after Open Design research

## Net new normalized features

### Added: Schema-driven skill contracts with typed intake and live parameter controls
- Why now: Open Design is showing a more explicit way to turn reusable agent skills into product surfaces by letting skill metadata generate the form, sliders, preview behavior, output contract, and capability gates around the model.
- Research delta:
  - Open Design extends the Claude Code `SKILL.md` format instead of replacing it, then adds an `od:` contract layer for typed `inputs`, live `parameters`, preview metadata, output manifests, and required capabilities
  - the same skill can stay compatible across agent ecosystems while still driving Open Design's richer UI
  - per-skill metadata decides whether design-system context is injected and which sections to prune for token savings
  - the product's discovery flow, tweak panels, and export behavior are all tied back to that structured skill contract rather than being generic chat affordances

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: Open Design sharpens the packaging story by making the skill definition rich enough to drive the surrounding user experience instead of only the prompt body.
- Research delta:
  - skill contracts can define typed form fields, live sliders, preview entrypoints, output files, and capability requirements
  - one canonical skill can be discovered across project, repo, and user scopes and optionally symlinked into multiple agent ecosystems
  - Open Design keeps compatibility with existing Claude Code skills while still adding product-specific affordances

### Expanded: External tool connectivity and actionability
- Why now: Open Design's latest release moves MCP from passive compatibility to a bidirectional integration layer with managed auth.
- Research delta:
  - the May 9, 2026 `0.6.0` release adds an external MCP client with daemon-managed OAuth
  - Open Design already ships its own MCP server, so the product now both exposes and consumes MCP capabilities
  - reconnect handling preserves OAuth state and advertised tool counts, which makes tool connectivity more operationally durable

### Expanded: Durable interactive agent artifacts
- Why now: Open Design is treating artifacts as publishable operational outputs rather than only local previews.
- Research delta:
  - artifacts render in a sandboxed iframe and stay editable through the workspace
  - the latest release adds direct PDF export
  - generated artifacts can now be deployed to Cloudflare Pages and attached to custom domains

### Added: Add schema-driven skill contracts with typed intake forms and live tweak controls
- Why now: `agent-browser` already has skills, widgets, and generated UI surfaces, but it does not yet provide a contract layer that can turn a skill into a structured intake and refinement experience instead of an ad hoc chat-plus-panel flow.
- Linear issue:
  - `TK-62`
- Linear issue title:
  - `Add schema-driven skill contracts with typed intake forms and live tweak controls`
- Suggested problem statement:
  - `agent-browser` can launch specialized agents and render durable surfaces, but it does not yet let a workflow or skill declare typed intake fields, live refinement controls, preview behavior, output manifests, and capability requirements that the product can enforce and render automatically.
- One-shot instruction for an LLM:
  - Implement schema-driven skill contracts for `agent-browser` so each workflow or skill can declare typed input fields, live tweak parameters, preview and export metadata, required capabilities, and output manifests; use that contract to generate intake UI, validation, refinement controls, and artifact handling automatically across local runs, automations, and review flows.

### Added: Turn-level checkpoints with chat-and-code rollback
- Why now: Conductor makes rollback a visible workspace primitive tied to the conversation timeline rather than a hidden implementation detail or a manual git escape hatch.
- Research delta:
  - Conductor checkpoints are stored in private git refs instead of the visible branch history
  - operators can restore from earlier chat turns inside the workspace flow
  - the `v0.44.0` changelog explicitly calls out improved checkpoint support for Codex sessions
  - Conductor pairs this rollback model with branch-isolated workspaces, so undo stays local to the task instead of mutating shared history

### Expanded: Parallel agent orchestration
- Why now: Conductor shows a more explicit topology choice than the simpler "spawn helpers" pattern by letting operators decide whether parallel agents should collaborate inside one workspace or stay split across isolated workspaces.
- Research delta:
  - Conductor documents both shared-workspace and separate-workspace parallelism
  - the product ties those choices directly to branch and runtime isolation
  - the workspace model makes parallelism feel like an operator decision about merge safety and coordination overhead, not just a background implementation detail

### Expanded: Git/PR-native execution
- Why now: Conductor's issue-to-PR flow is unusually explicit about the full delivery loop from tracked issue to validated diff, pull request, and archive.
- Research delta:
  - work starts from an issue-backed workspace, not just a freeform prompt
  - inline diff review is a first-class surface before PR creation
  - the checks tab combines validation commands and unresolved todos as a readiness gate
  - archive is treated as the end of the workflow after the landing step

### Expanded: External tool connectivity and actionability
- Why now: Conductor is pushing MCP from static configuration toward inherited, inspectable runtime state.
- Research delta:
  - project-level MCP settings can now be inherited into workspaces
  - `v0.50.0` adds `/mcp-status` for Codex sessions plus MCP-server indicators in chat
  - the connectivity layer is being surfaced as a runtime health concept instead of only a setup file

### Added: Self-organizing swarm execution with context sharding
- Why now: Kimi AI shows a stronger orchestration pattern than ordinary "launch a few helpers" subagents by letting the system invent its own specialist team structure at runtime and keep each worker on its own context shard.
- Research delta:
  - Kimi's current Agent Swarm surface says users do not need predefined roles or hand-crafted workflows
  - the orchestrator can coordinate up to 300 sub-agents and more than 4,000 tool calls in one task
  - Kimi says the swarm is about 4.5x faster than single-agent execution
  - context sharding gives each sub-agent its own notebook and only promotes key conclusions back to the commander
  - after the swarm run, users can switch back to a single K2.6 Agent for follow-up turns instead of staying trapped inside the swarm surface

### Expanded: Browser use and computer control
- Why now: Kimi's browser-control story is not just first-party computer use; it is an attachable local bridge that can upgrade multiple outside harnesses.
- Research delta:
  - Kimi WebBridge installs as a local service plus browser extension
  - it uses Chrome DevTools Protocol to navigate, click, screenshot, and read pages in the user's existing Chrome or Edge session
  - Kimi explicitly says page content and login sessions stay on the user's device
  - the supported-agent list includes Kimi Code, Claude Code, Cursor, Codex, and Hermes

### Expanded: Multi-surface continuity
- Why now: Kimi is spreading one agent family across general chat, specialist deliverable surfaces, mobile, desktop, cloud-deployed Claws, and linked self-hosted OpenClaw instances.
- Research delta:
  - K2.6 Agent spans websites, documents, spreadsheets, slides, deep research, and swarm mode from one top-level surface
  - Kimi Claw can be one-click deployed from the web, linked from an existing OpenClaw, and connected to Telegram and other chat channels
  - WebBridge and Kimi Desktop extend the same ecosystem into a local browser-control loop

### Added: Add self-organizing swarm execution with context sharding
- Why now: `agent-browser` already supports multiple agents and worktree-style isolation, but it still expects humans to decide most delegation structure and does not yet expose bounded context shards as a first-class orchestration primitive.
- Linear issue:
  - `TK-60`
- Linear issue title:
  - `Add self-organizing swarm execution with context sharding`
- Suggested problem statement:
  - `agent-browser` can launch multiple agent runs, but it does not yet provide a swarm mode where an orchestrator decides how to decompose work at runtime, spins up many bounded child agents, shards context intentionally, and reconciles their outputs back into one inspectable result without human-authored role graphs.
- One-shot instruction for an LLM:
  - Implement a self-organizing swarm mode for `agent-browser` where a commander agent can decide parallel width dynamically, spawn bounded child agents with explicit context shards and objectives, monitor sub-agent progress and tool use, merge findings into a structured final output, and let operators continue the same task in a single-agent follow-up mode after the swarm finishes.

### Added: Add turn-level checkpoints with chat-and-code rollback
- Why now: `agent-browser` supports durable artifacts, diffs, and long-running sessions, but it still lacks a first-class rollback layer that lets operators jump back to a prior turn without relying on branch surgery or manual cleanup.
- Linear issue:
  - `TK-61`
- Linear issue title:
  - `Add turn-level checkpoints with chat-and-code rollback`
- Suggested problem statement:
  - `agent-browser` can show transcript history and changed files, but it does not yet provide per-turn checkpoints that snapshot workspace state, keep rollback data separate from visible repository history, and let users safely restore an earlier point in the run from the UI.
- One-shot instruction for an LLM:
  - Implement turn-level checkpoints for `agent-browser` that snapshot code, artifacts, and relevant session state before each agent step, store those checkpoints outside the visible task branch, expose them in the transcript or timeline with restore and compare actions, and make rollback safe, inspectable, and compatible with long-running browser-agent workflows.

### Added: Mode-scoped execution profiles with sticky task inheritance
- Why now: Roo Code shows a strong execution-control pattern for multi-model harnesses where profile choice is tied to agent mode and preserved across resumes, worktrees, and delegated subtasks.
- Research delta:
  - Roo profiles can package provider, model, thinking-budget, temperature, diff-edit, and rate-limit settings
  - users can pin profiles, switch them from chat, and explicitly bind profiles to modes
  - each task remembers the profile it started with when reopened from history
  - Orchestrator subtasks inherit the parent profile and keep it for their lifetime
  - the April 23, 2026 `v3.53.0` repo README adds GPT-5.5 support through the OpenAI Codex provider, reinforcing Roo's execution-profile posture

### Expanded: Background execution without stealing focus
- Why now: Roo pairs background progress with active user steering instead of forcing the task back to an idle handoff state first.
- Research delta:
  - Roo's Message Queueing lets users send follow-up instructions while the agent is still working
  - queued messages are processed FIFO and stay editable until they run
  - a queued message implicitly approves the next pending action, even if normal auto-approval is disabled
  - Intelligent Context Condensing keeps long-running threads coherent while those queued follow-ups continue to accumulate

### Expanded: Git/PR-native execution
- Why now: Roo Code Cloud turns branch creation, review comments, and review-driven fixes into specialized agent roles instead of one monolithic coding flow.
- Research delta:
  - the Coder agent can commit, push, and open PRs
  - the Reviewer agent can automatically review new PRs and later commits
  - the Fixer agent can read PR comments and push fixes back onto the branch
  - the same cloud team is reachable from GitHub, Slack, and the web dashboard

### Added: Add mode-scoped execution profiles with sticky task inheritance
- Why now: `agent-browser` already supports multiple agent surfaces and model choices, but it lacks a durable execution-profile layer that keeps routing decisions stable across resumes, child runs, and role handoffs.
- Linear issue:
  - `TK-58`
- Linear issue title:
  - `Add mode-scoped execution profiles with sticky task inheritance`
- Suggested problem statement:
  - `agent-browser` can route work across different agents and model surfaces, but it does not yet provide a first-class execution-profile system where provider, model, budget, and policy settings can be bound to a role and then inherited predictably across resumed runs, delegated tasks, and isolated workspaces.
- One-shot instruction for an LLM:
  - Implement execution profiles for `agent-browser` that let users define provider, model, thinking-budget, rate-limit, and tool-policy settings per profile, bind those profiles to agent roles or modes, and keep the selected profile sticky across resumes, child runs, worktrees, and remote execution unless a human explicitly overrides it.

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

### Added: Deterministic workflow graphs around agent steps
- Why now: n8n is showing a strong harness pattern where the agent is only one node in a broader operational graph that also includes deterministic steps, approvals, reusable subflows, evaluations, and deployment-safe publishing.
- Research delta:
  - AI Workflow Builder turns natural-language intent into a workflow and exposes real-time build phases instead of only returning a chat answer
  - the AI Agent Tool node lets one agent delegate to specialized child agents as tools, including multi-tier trees and fallback models
  - the Call n8n Workflow Tool turns whole workflows into reusable tools and supports AI-filled parameters through typed fields and `$fromAI()`
  - n8n pauses workflows for per-tool human approval and now supports Chat actions that can message a user and wait for a response inside the same execution
  - built-in light and metric-based evaluations plus versioned publishing, rollback, and concurrency protection make the workflow graph itself a governed operational artifact

### Expanded: Embeddable agent runtimes and protocol surfaces
- Why now: n8n's April 29, 2026 MCP update moved the product from "external agents can trigger workflows" to "external agents can create, edit, validate, test, and rerun workflows inside the instance."
- Research delta:
  - instance-level MCP access now exposes workflow and data-table management in addition to execution
  - n8n positions the MCP server as first-party, built in, and available across Cloud, Enterprise, and Community Edition
  - the workflow-building loop now commonly validates, executes, reads errors, fixes, and retries without leaving the client conversation

### Expanded: Evaluation-native observability and live scoring
- Why now: n8n has one of the clearest productized eval surfaces for operational AI workflows, with explicit pre-deployment and post-deployment modes.
- Research delta:
  - evaluation is dataset-backed from the start, not only trace-backed after deployment
  - n8n explicitly frames evaluations as the way to compare models and prompts and to preserve confidence across edge cases
  - metric-based evaluation turns workflow quality into an ongoing measurable surface rather than a manual eyeballing exercise

### Added: Add workflow-graph orchestration with deterministic, agent, and human-review steps
- Why now: `agent-browser` already has automations, browser evidence, tools, and agent routing, but it still lacks a first-class workflow graph that can mix deterministic control flow with agent reasoning, pause states, approvals, and release-safe lifecycle controls.
- Linear issue:
  - `TK-59`
- Linear issue title:
  - `Add workflow-graph orchestration with deterministic, agent, and human-review steps`
- Suggested problem statement:
  - `agent-browser` can run chat agents and automations, but it does not yet provide a workflow-native orchestration layer where deterministic steps, specialized agent nodes, human checkpoints, reusable subflows, evaluations, and publish-or-rollback controls can be composed into one governed execution graph.
- One-shot instruction for an LLM:
  - Implement a workflow-graph orchestration system for `agent-browser` that lets users compose deterministic steps, agent nodes, reusable workflow-tools, human approval or clarification checkpoints, dataset-backed evaluation nodes, and versioned publish or rollback controls, then run that graph locally or remotely with inspectable state, retry semantics, and linked browser/code evidence.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Add turn-level checkpoints with chat-and-code rollback`
