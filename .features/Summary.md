# Agent Harness Competition Summary

Updated: 2026-05-10
Scope: `ChatGPT`, `Claude Code`, `Claude Cowork`, `Claude in Chrome`, `Cline`, `Codex`, `Cursor`, `DeerFlow`, `Devin`, `Gemini CLI`, `GitHub Copilot`, `Goose`, `Hermes Agent`, `Kilo Code`, `Mastra`, `n8n`, `OpenAI Symphony`, `OpenClaw`, `OpenCode`, `OpenHands`, `Pi`, `Roomote`, `Roo Code`, `Space Agent`, `T3 Code`, `Warp`
Method: current-product research from first-party product pages, help centers, docs, release notes, changelogs, and official project properties where available.

## Normalized feature themes

### 1. Parallel agent orchestration
- Common pattern: users supervise multiple isolated workers instead of a single chat thread.
- Seen in: Codex app multi-agent threads and worktrees, Claude Code subagents, Claude Cowork parallel workstreams, Cline subagents and parallel worktrees, Cursor `/multitask` async subagents plus tiled agent management, DeerFlow planning and sub-tasking, Devin managed child sessions plus Advanced Mode parallel Devins, Gemini CLI subagents plus remote A2A delegation plus worktree-isolated sessions, Goose internal and external subagents with sequential and parallel execution, Hermes parallel sub-agents, Mastra supervisor coordination, OpenAI Symphony issue-to-agent orchestration, OpenClaw multi-agent workspaces, GitHub Copilot custom agents as subagents plus cloud agent plus third-party agents, OpenCode multi-session agents, Roo Code built-in Orchestrator plus cloud agent team, T3 Code worktree-aware thread spawning.
- Why it matters: once agent quality is acceptable, the UX bottleneck becomes coordination, not raw generation.
- One-shot build instruction:
  - Build a workspace-level orchestration surface that can launch multiple isolated agent runs against the same repo or task bundle, show per-agent state, preserve context separately, and support human steering, pause/resume, and compare/merge of outputs.

### 2. Persistent memory plus project instructions
- Common pattern: harnesses retain repo, workflow, and user preferences across runs.
- Seen in: Claude Code `CLAUDE.md` plus auto memory, ChatGPT project memory, Cline Memory Bank, Copilot Memory, DeerFlow long-term memory, Devin Knowledge with folders, triggers, macros, and suggestions, Gemini CLI layered `GEMINI.md` plus imports plus Auto Memory review inbox, Hermes persistent memory, Codex skills/team config, Cursor project rules plus memories plus `AGENTS.md` and commands, OpenClaw workspace identity/config, OpenCode `AGENTS.md` project rules, Pi layered `AGENTS.md` or `CLAUDE.md` plus system-prompt files.
- Why it matters: repeated steering is turning into the main productivity tax.
- One-shot build instruction:
  - Add layered memory with explicit scopes (`workspace`, `project`, `user`, `agent`) and clear precedence, plus a memory inspector/editor so users can see, edit, import, disable, and diff what the harness has learned.

### 3. Skills, plugins, and reusable workflow packaging
- Common pattern: vendors are productizing repeatable agent behaviors as installable units.
- Seen in: Codex skills, Claude Cowork plugin marketplace, Claude Code custom commands, Cline skills and workflows, Copilot custom agents plus Agent Skills plus prompt files, Cursor commands plus plugin marketplaces, DeerFlow skills and Claude Code bridge, Devin Playbooks with macros, community sharing, and version history, Gemini CLI extensions packaging commands, prompts, tools, hooks, MCP config, subagents, themes, and policy, Goose recipes, subrecipes, recipe deeplinks, and recipe generator tooling, Hermes automated skill creation, Mastra versioned skills and publish flow, OpenClaw skills and plugins, OpenCode custom commands and agent definitions, OpenHands `AGENTS.md` plus `SKILL.md` progressive disclosure plus slash-menu discovery, Pi packages plus extensions/skills/prompts/themes, Roo Code marketplace MCPs plus modes plus on-demand skills, Space Agent self-extending `SKILL.md` capabilities, T3 Code provider skill discovery.
- Why it matters: durable workflows outperform ad hoc prompting for team adoption.
- One-shot build instruction:
  - Create a first-class workflow package format with metadata, prompts, scripts, permissions, test hooks, and share/install UX; include auto-suggestion of relevant skills during task intake.

### 4. Scheduled automations and background execution
- Common pattern: agents now run on schedules and return results later.
- Seen in: Codex Automations, ChatGPT Tasks, ChatGPT workspace agents schedules, Claude Cowork scheduled tasks, Claude in Chrome scheduled shortcuts, Cursor background agents and Slack/web launch surfaces are adjacent here even when the trigger is human-initiated, Devin scheduled sessions plus automation history and notifications, Goose scheduled recipes with background execution and run history, Hermes scheduled automations, OpenClaw always-on agent framing, OpenHands Cloud automations with fresh sandboxes and resumable conversations.
- Why it matters: recurring operational work is a strong wedge for agent retention.
- One-shot build instruction:
  - Add a scheduler for one-off, recurring, and event-triggered jobs, with inbox-style results, retry history, last-run artifacts, and per-automation permissions.

### 5. Browser use and computer control
- Common pattern: harnesses are expanding from code/text to direct web and desktop action.
- Seen in: ChatGPT agent mode, Claude in Chrome, Claude Cowork computer use, Cline web tools and browser automation, Cursor browser controls plus layout editor plus debug mode, DeerFlow AIO sandbox, Devin interactive browser inside the progress workspace, Goose Computer Controller with web interaction and desktop GUI control, Hermes browser/web control, Mastra browser providers with live Studio supervision, OpenClaw browser automation, Space Agent registered browser surfaces across popup and inline runtime widgets.
- Why it matters: many valuable workflows still terminate in websites or GUI tools rather than APIs.
- One-shot build instruction:
  - Ship a browser/desktop action layer that can inspect DOM, screenshots, console and network state, request confirmation for risky actions, and feed captured evidence back into the agent thread.

### 6. Multi-surface continuity
- Common pattern: users start in one surface and continue elsewhere.
- Seen in: Codex app + CLI + IDE + cloud, Claude Code terminal + web + JetBrains, ChatGPT web/mobile/desktop/Slack, Claude Cowork desktop + phone thread, Cline editor + CLI, Copilot terminal + GitHub + mobile + Raycast + agents tab + VS Code, Cursor desktop + web + mobile + Slack + cloud agents, DeerFlow IM channels, Goose desktop + CLI + API + ACP clients + mobile/Telegram remote access, Hermes chat apps + CLI, OpenClaw any messenger + local runtime, OpenCode terminal + desktop + IDE, Roomote Slack + web dashboard + Linear assignment + GitHub mentions, Roo Code IDE + web dashboard + GitHub + Slack, Space Agent browser runtime + native desktop app + self-hosted server, T3 Code remote pairing plus headless serve.
- Why it matters: agents are becoming ambient systems, not point tools.
- One-shot build instruction:
  - Unify state across terminal, browser, desktop, mobile, and collaboration surfaces so the same run can be viewed, steered, and resumed anywhere without losing logs, artifacts, or permissions state.

### 7. Git/PR-native execution
- Common pattern: successful coding harnesses end in branches, diffs, and PRs rather than plain text.
- Seen in: Codex diff review, Claude Code git-native commits/PRs, Cline checkpoints and worktrees, Copilot cloud agent branch/PR flow, Cursor Bugbot plus PR review flows plus SDK auto-PR support, Devin Review plus PR-linked bug catching, OpenAI Symphony proof-of-work packets and safe landing, OpenClaw development use cases, OpenHands issue and PR resolution through `fix-me` labels and `@openhands-agent` comments, Roomote PR-based delivery with self-review, merge-conflict handling, and visible diff-plus-artifact handoff, Roo Code Coder/Reviewer/Fixer agent flow through GitHub.
- Why it matters: reviewable change sets are easier to trust than chat responses.
- One-shot build instruction:
  - Make code tasks branch-native: create isolated workspaces, show structured diffs, attach validation output, support inline review comments, and optionally open a PR when acceptance checks pass.

### 8. External tool connectivity and actionability
- Common pattern: harnesses increasingly connect to third-party tools, apps, or MCP servers.
- Seen in: Codex skills for Linear/Figma/cloud hosts, Claude Code MCP, ChatGPT apps, Cline MCP marketplace and server builder, Copilot MCP, Claude Cowork connectors/plugins, Cursor MCP Apps plus Bugbot MCP plus plugin marketplaces, DeerFlow MCP servers and InfoQuest, Devin MCP marketplace plus remote custom transports plus API/ACP surfaces, Gemini CLI MCP-aware extensions plus remote agents plus model-routing control, Goose 70+ MCP extensions plus roots-aware workspace wiring and smart extension recommendation, Hermes multi-provider integrations, Mastra MCP client/server plus approval flow, n8n's instance-level MCP server plus workflow-tool composition and 500+ integrations, OpenAI Symphony `linear_graphql` tool bridge, OpenClaw integrations, OpenCode MCP servers and custom tools, OpenHands GitHub/GitLab/Bitbucket/Slack/Jira integrations plus API and SDK surfaces, Roomote GitHub + Slack + Linear + docs + logs integrations as a default operating posture, Roo Code project/global MCP installs plus team-enforced MCP policy.
- Why it matters: standalone agents plateau quickly without live context or write access.
- One-shot build instruction:
  - Build a secure tool-connectivity layer with read/write scopes, audited invocation logs, secret isolation, per-skill tool policies, and reusable integrations for issue trackers, docs, storage, and deploy targets.

### 9. Shared team agents and governance
- Common pattern: products are moving from personal assistants to organization-shared agents.
- Seen in: ChatGPT workspace agents, Claude Cowork admin controls and analytics, Cline enterprise-managed skills, Copilot enterprise controls plus policy-managed third-party agents, Codex team-configured skills, Cursor team marketplaces plus team permissions on cloud agents, Space Agent user/group layers with admin control plane and shared customware.
- Why it matters: repeated team workflows need ownership, review, and policy controls.
- One-shot build instruction:
  - Add shared workspace agents with publishing, versioning, approval, RBAC, analytics, and team discovery so repeatable workflows become institutional assets instead of personal prompt lore.

### 10. Personalization, routing, and specialized personas
- Common pattern: harnesses increasingly expose custom personas, routing, or specialized sub-agents.
- Seen in: Codex personalities, Claude Code subagents, Copilot custom agents, DeerFlow custom agent routing in IM channels, OpenClaw agent identities/routing, Hermes self-improving skills, OpenCode primary and subagent roles.
- Why it matters: one general-purpose agent is less effective than a small system of constrained specialists.
- One-shot build instruction:
  - Support specialized agent profiles with explicit purpose, tool allowances, routing rules, and invocation heuristics, plus a way to compare outcomes across specialists on the same task.

### 11. Chat-channel ingress and ambient command surfaces
- Common pattern: harnesses increasingly accept tasks from messaging channels instead of requiring the primary web or IDE surface.
- Seen in: DeerFlow Telegram/Slack/Feishu/WeChat/WeCom channels, Devin Slack task ingress and session permalinks, Goose Telegram Gateway and mobile remote access, OpenClaw chat-app-everywhere interface, Hermes multi-platform gateway, Claude Cowork phone-managed persistent thread, Roomote Slack-first task intake with GitHub mentions and Linear assignment as secondary entry points.
- Why it matters: task intake and follow-up often happen where teams already communicate, not where the harness was originally launched.
- One-shot build instruction:
  - Add chat-native ingress for supported channels with per-channel auth, thread/session mapping, slash-style commands, file handoff, and safe routing into existing agent runs without fragmenting history.

### 12. Shareable sessions and debug handoff
- Common pattern: harnesses increasingly let users publish a run artifact that others can inspect without replaying the whole session locally.
- Seen in: OpenCode share links, GitHub Copilot cloud logs and PR sessions, Codex thread sharing and review surfaces, Cursor web share links plus desktop handoff, Devin Slack session permalinks and review surfaces, Pi private gist sharing plus public OSS session publishing, Roo Code task sharing plus cloud task monitoring.
- Why it matters: async debugging and review improve when the run itself is a portable artifact rather than an anecdote.
- One-shot build instruction:
  - Add review-safe run sharing that publishes a sanitized session artifact with transcript, artifacts, diff links, and verification evidence, plus retention controls and a clear private-by-default policy.

### 13. Remote pairing and traceable operations
- Common pattern: newer harnesses are exposing remote-access flows while also shipping stronger operational traces for debugging multi-device or long-running sessions.
- Seen in: T3 Code remote pairing tokens, QR-code onboarding, session revocation, and local NDJSON tracing; Codex and ChatGPT are adjacent here through cloud-managed execution; Cursor self-hosted workers, reconnection, and explicit run lifecycle controls now strengthen the same operational direction without the same pairing UX.
- Why it matters: once agents run beyond one terminal window, connectivity and postmortem visibility become product requirements.
- One-shot build instruction:
  - Add secure remote session pairing for browser-agent workspaces, include device/session management and revocation, and back it with structured local traces plus optional OTLP export so operators can debug long-lived runs.

### 14. Background execution without stealing focus
- Common pattern: harnesses are reducing UI interruption so the agent can keep working while the human keeps editing or supervising elsewhere.
- Seen in: Cline Background Edit plus background terminal execution, Claude in Chrome background workflows, Cursor background agents, ChatGPT scheduled/background runs, Roo Code queued follow-up steering while work continues.
- Why it matters: high-agency agents become less useful if every diff, terminal handoff, or focus change blocks the user.
- One-shot build instruction:
  - Add a background execution mode that streams diffs, tool output, and validation status into a side panel or timeline without forcing focus changes, while preserving one-click rollback and approval controls.

### 15. Issue-tracker control planes and dependency-aware execution
- Common pattern: the issue tracker is becoming the primary orchestration surface, with agents dispatching from tracker state instead of from manually launched chat sessions.
- Seen in: OpenAI Symphony explicitly maps Linear issues to dedicated runs, respects blocked dependencies, and continues working until a workflow-defined handoff state is reached.
- Why it matters: work management systems already encode priority, ownership, and blockers, so using them directly reduces session babysitting and makes parallel execution easier to reason about.
- One-shot build instruction:
  - Build a tracker-native orchestration mode that polls eligible issues, maps each issue to an isolated browser-agent run, respects blocker relationships and handoff states, and lets humans supervise progress from the project board rather than from individual sessions.

### 16. Repo-owned workflow contracts and live operational reload
- Common pattern: runtime policy is moving into versioned repository contracts instead of being hidden in local prompts or service config.
- Seen in: OpenAI Symphony `WORKFLOW.md` with YAML front matter, strict prompt rendering, hooks, agent settings, and required live reload on file change.
- Why it matters: teams need agent behavior, setup rules, and safety posture to evolve under version control alongside the codebase the agent is changing.
- One-shot build instruction:
  - Add a repository-owned workflow contract file for browser agents that defines prompt policy, workspace hooks, tool settings, concurrency, and tracker integration, then reload it live with validation, last-known-good fallback, and clear operator-visible errors.

### 17. Operator-facing orchestration telemetry
- Common pattern: long-running agent systems increasingly expose runtime state through structured logs, dashboards, and debug APIs rather than expecting operators to infer health from terminal noise.
- Seen in: OpenAI Symphony structured logs, optional status surface, Phoenix dashboard, and `/api/v1/*` observability endpoints; OpenHands control-plane audit and cost views plus OTEL tracing.
- Why it matters: once a harness runs continuously across many issues, operator trust depends on inspectable health, queue, retry, and session state.
- One-shot build instruction:
  - Build an operator telemetry surface for browser-agent orchestration with structured logs, queue and session views, issue-specific debug pages, and a read-mostly JSON API that supports refresh triggers and postmortem inspection.

### 18. Embeddable agent runtimes and protocol surfaces
- Common pattern: some harnesses are no longer just end-user apps and are instead exposing stable runtime layers other products can embed directly.
- Seen in: Pi interactive plus print/JSON plus JSON-RPC plus SDK modes, Cursor SDK plus durable Cloud Agents API, Gemini CLI headless mode plus JSON and streaming automation surfaces, Goose desktop plus CLI plus API plus ACP server and ACP provider bridge, n8n's built-in MCP server that can search, test, create, and edit workflows and data tables from external clients, OpenAI Symphony operator APIs, OpenHands SDK plus API and large-codebase coordination, T3 Code headless serve, and GitHub Copilot's growing cross-surface agent presence.
- Why it matters: product teams increasingly want the same agent core available in the terminal, in the browser, in IDEs, and inside orchestrators without re-implementing session, transport, and tool behavior each time.
- One-shot build instruction:
  - Expose browser-agent sessions through a reusable runtime contract with both in-process and subprocess transports, including a typed SDK, a documented streaming protocol, request correlation, session lifecycle controls, and enough stability that other internal surfaces can embed the harness instead of screen-scraping it.

### 19. Agent-ready remote environments and trigger wiring
- Common pattern: hosted agent systems are increasingly packaging reusable execution environments together with triggers from issue trackers, chat systems, and CI so automation can start from live business events instead of a local terminal.
- Seen in: Warp Cloud Agents with reusable setup plus GitHub, Linear, Slack, scheduled runs, and GitHub Actions triggers; OpenAI Symphony isolated issue workspaces and workflow hooks are adjacent from the orchestration side; OpenHands cloud agents with Kubernetes-based isolated runtimes, issue triggers, Slack and Jira events, and scheduled automations; Roo Code preview environments plus cloud task sync and analytics.
- Why it matters: reliable automation depends on reproducible remote environments and first-class launch wiring, not just a strong prompt in a developer laptop session.
- One-shot build instruction:
  - Build reusable remote execution environments for browser agents with repo bootstrap, secrets, and dependency setup captured once, then let users bind those environments to schedules, issue events, chat commands, and CI triggers with clear audit history and replayable launch parameters.

### 20. Mutable agent-built workspace surfaces
- Common pattern: a few harnesses are starting to treat the product surface itself as something the agent can construct and reshape, instead of limiting the agent to a fixed chat panel or detached tool result.
- Seen in: Space Agent explicitly makes pages, widgets, workflows, and browser surfaces part of the live runtime the agent can build into; Cursor canvases and MCP Apps are a more constrained but increasingly durable version of the same direction; some browser agents are adjacent through tool-driven UI updates, but these two products currently make the idea clearest.
- Why it matters: once the agent can create the working surface itself, the harness can evolve from chat UI into a dynamic workspace optimized around the task at hand.
- One-shot build instruction:
  - Let browser agents create and persist task-specific workspace surfaces such as dashboards, widgets, guided flows, browser panes, and review panels inside the app itself, with clear ownership, permissions, and rollback for anything the agent adds or changes.

### 21. Durable interactive agent artifacts
- Common pattern: agent runs are starting to emit first-class interactive artifacts that stay attached to the operational workspace instead of disappearing into the transcript.
- Seen in: Cursor canvases in the Agents Window, Goose Apps extension with chat-built MCP App resources, MCP Apps rendered inside chats, and Space Agent task-built widgets and pages.
- Why it matters: planning, debugging, and review often benefit from a persistent dashboard, diagram, checklist, or custom interface that the user can return to after the run finishes.
- One-shot build instruction:
  - Add durable agent-authored artifacts such as canvases, dashboards, diagrams, and review panels that live alongside transcript, terminal, browser, and diff views; make them addressable, persistable, and safe to update incrementally across follow-up turns.

### 22. Reusable harness cores for agent-powered apps
- Common pattern: some vendors are starting to expose the harness plumbing itself as a reusable product primitive instead of keeping it trapped inside one end-user surface.
- Seen in: Mastra Core Harness with modes, state, built-in tools, memory, approvals, and subagents; Cursor SDK plus durable Cloud Agents API from the runtime side; Pi JSON-RPC plus SDK plus TUI modes; T3 Code headless serve.
- Why it matters: teams increasingly want one agent runtime that can power the desktop app, automations, browser shells, operator consoles, and embedded product surfaces without duplicating orchestration logic.
- One-shot build instruction:
  - Extract browser-agent into a reusable harness core package with mode and thread lifecycle management, built-in approval and planning tools, subagent support, memory hooks, and evented runtime telemetry so both the app UI and automations run on the same engine.

### 23. Evaluation-native observability and live scoring
- Common pattern: newer agent platforms are starting to fuse traces, quality scoring, and experiments into the same operational surface instead of treating evals as an offline research-only activity.
- Seen in: Mastra Observability plus Scorers plus Studio experiments most explicitly; n8n light and metric-based evaluations add dataset-backed pre-deployment and post-deployment workflow scoring; OpenAI Symphony proof-of-work packets and operator telemetry are adjacent from the orchestration side.
- Why it matters: once agents run continuously, teams need to see not only what happened, but whether quality, safety, and tool behavior are drifting over time.
- One-shot build instruction:
  - Add evaluation-native observability for browser agents with trace capture, live scorer hooks, experiment datasets, issue-linked regression views, and operator dashboards that connect run evidence to quality signals.

### 24. Verification-native critic stacks and adaptive retries
- Common pattern: some harnesses are starting to score trajectories during the run, using lightweight critics or verifiers to decide whether to continue, stop, refine, or compare multiple attempts before humans review a final diff.
- Seen in: OpenHands trajectory-level critic model trained on production traces and sparse production outcomes such as PR merge and code survival; several other products have review or proof surfaces, but OpenHands currently states this runtime verification loop most directly.
- Why it matters: browser and coding agents need cheap online quality checks so failures can be caught and redirected before they waste budget or open low-confidence changes.
- One-shot build instruction:
  - Add a lightweight trajectory critic layer for browser-agent runs that scores tool traces and intermediate artifacts, decides whether to continue, stop, retry, or branch, and records the rationale beside validation output so humans can inspect why the harness trusted or rejected a run.

### 25. Benchmark-informed model routing and task-aware model choice
- Common pattern: model-agnostic harnesses are beginning to expose benchmark surfaces that help users route planning, implementation, testing, and information-gathering work to different models based on cost, latency, and task fit.
- Seen in: OpenHands Index with broad task coverage and explicit framing around choosing different models for planning, implementation, and review/testing; Pi, OpenCode, and other model-agnostic harnesses are adjacent on routing flexibility but not as benchmark-driven.
- Why it matters: once a harness supports many models, the next product problem is choosing the right one for the job instead of pretending one model is universally best.
- One-shot build instruction:
  - Build benchmark-informed model routing for browser agents by maintaining task-class evaluations, exposing cost and latency tradeoffs, and using those signals to recommend or auto-select different models for planning, execution, verification, and follow-up research.

### 26. Review-native pull request understanding
- Common pattern: some harnesses are investing in dedicated review surfaces that help humans understand, group, and challenge a change set after generation, instead of treating the PR as a generic diff viewer.
- Seen in: Devin Review most explicitly, Cursor Bugbot and PR review surfaces, Codex diff review flows, and GitHub Copilot's growing PR-agent review posture.
- Why it matters: once agents can produce code quickly, the next bottleneck is reviewer comprehension and confidence, not raw patch generation speed.
- One-shot build instruction:
  - Build a review-native PR understanding surface for browser-agent work that groups related changes, summarizes intent, flags likely risks, links evidence such as tests or browser recordings, and supports comment-driven follow-up runs without forcing reviewers back into raw diff spelunking.

### 27. Repository-grounded wiki generation and architecture views
- Common pattern: harnesses are beginning to turn live repositories into durable, code-grounded wiki artifacts with maps and diagrams rather than relying on repeated ad hoc explanation.
- Seen in: Devin DeepWiki most directly; OpenHands large-codebase coordination and several memory-heavy harnesses are adjacent, but Devin currently makes the persistent repo-wiki surface the clearest product feature.
- Why it matters: large-codebase work gets faster when onboarding context, architecture shape, and code navigation live in a maintained artifact that both humans and agents can reuse.
- One-shot build instruction:
  - Add a repository-grounded knowledge surface for browser-agent projects that can generate and refresh codebase maps, architecture diagrams, grounded explanations, and navigable onboarding pages from the current repo state, then let agent runs cite and update those artifacts over time.

### 28. Private local inference and offline-first execution
- Common pattern: some harnesses are now bundling local inference directly into the product so users can run agents privately, offline, and without extra sidecar services.
- Seen in: Goose built-in local inference powered by embedded `llama.cpp`; a few other harnesses support local models through external tools, but Goose currently makes the no-server, zero-dependency path the clearest product surface.
- Why it matters: many teams want agent workflows to work on sensitive codebases or intermittent-network environments without assuming cloud APIs or a separate local model daemon.
- One-shot build instruction:
  - Add a built-in local inference path for browser-agent sessions that can run offline, manage downloadable local models inside the app, expose clear capability limits, and let users switch between local and hosted execution without changing the rest of the harness workflow.

### 29. Context-aware tool-call guardrails with adversary review
- Common pattern: agent harnesses are starting to move beyond coarse approval modes by adding runtime reviewers that evaluate tool calls against task intent before execution.
- Seen in: Goose permission modes plus Adversary Mode, where an independent reviewer checks proposed tool calls against the original task, recent context, and user rules before allowing or blocking them.
- Why it matters: browser and desktop agents need stronger protection against prompt injection, goal drift, and unsafe automation than simple approve-once dialogs can provide.
- One-shot build instruction:
  - Add an adversary-style runtime reviewer for browser-agent tool calls that scores each planned action against user intent, recent context, and policy, then allows, blocks, or escalates the action with inspectable rationale and a fail-safe operator experience.

### 30. Chaptered session structure and automatic context compression
- Common pattern: some harnesses are starting to actively restructure and compress long-running sessions instead of leaving transcript growth and narrative coherence entirely to the model.
- Seen in: Gemini CLI `Chapters Narrative Flow`, `Context Compression Service`, and the follow-on `ContextManager` work called out in the April and May 2026 changelogs.
- Why it matters: long browser and coding sessions eventually become hard to navigate, expensive to continue, and easy to derail unless the harness manages session structure and context budget explicitly.
- One-shot build instruction:
  - Add chaptered session structure and automatic context compression for browser-agent runs so long tasks are grouped into navigable sections, summaries stay inspectable and linked to the full trace, and the harness can keep working coherently without dragging the full raw transcript forward forever.

### 31. Policy-governed partner-agent control planes
- Common pattern: at least one major platform is turning its primary agent surface into a host for multiple vendors' coding agents under one shared governance, audit, and workflow layer.
- Seen in: GitHub Copilot third-party agents for Claude and Codex, the shared agents tab and issue/PR/mobile/VS Code entry points, and per-agent model selection on github.com.
- Why it matters: once teams want multiple agent vendors, the durable product advantage shifts toward unified policy, review, cost control, and workflow continuity rather than toward any single built-in model.
- One-shot build instruction:
  - Add a partner-agent control plane for browser-agent work that can host multiple internal or external agent backends behind one session UX, unify permissions and audit logging, expose per-agent model selection, and preserve the same issue, diff, and review workflow regardless of which agent executes the task.

### 32. Enterprise model governance and spend-aware operations
- Common pattern: agent platforms are starting to expose org-level controls over which models can run, how budget is enforced, and how usage is analyzed across the growing set of agent surfaces.
- Seen in: Cursor provider/model allow and block lists, default blocking of new model versions, soft spend limits with alerts, and per-surface usage analytics across clients, Cloud Agents, automations, Bugbot, and Security Review.
- Why it matters: once a harness spans foreground chats, background agents, automations, and reviewers, enterprise rollout depends on policy and spend controls that work across all of them.
- One-shot build instruction:
  - Add enterprise governance for browser-agent models with provider/model policy controls, soft and hard spend budgets, progressive usage alerts, and analytics broken down by user, agent surface, and automation type.

### 33. Always-on specialist security review agents
- Common pattern: coding harnesses are starting to ship dedicated security agents that review PRs and run scheduled scans as first-class product surfaces instead of relying only on generic coding agents or external scanners.
- Seen in: Cursor Security Review with `Security Reviewer` inline PR comments, `Vulnerability Scanner` scheduled scans, Slack delivery, and MCP-based customization for existing security tools.
- Why it matters: specialized reviewer agents let teams operationalize security checks inside the same control plane already used for coding, orchestration, and policy.
- One-shot build instruction:
  - Build specialized browser-agent security reviewers that can inspect diffs and scheduled repo state, leave inline severity-tagged findings with remediation, integrate external security tools, and deliver scan updates through the team channels already used for automation.

### 34. Runtime plugin layers with tool-call interception
- Common pattern: some harnesses are exposing a true runtime extension layer that can observe events, mutate tool calls, and enforce policy during execution instead of only packaging prompts or static tools.
- Seen in: Kilo Code plugins that can add tools, intercept tool calls, block dangerous operations, register model and auth providers, react to session and permission events, and customize compaction or shell environments.
- Why it matters: once agents touch terminals, browsers, and external services, extensibility needs to happen at execution time, not only at prompt construction time.
- One-shot build instruction:
  - Add a browser-agent plugin runtime that can register tools and providers, subscribe to execution events, intercept or veto tool invocations, inject environment or transport behavior, and expose clear audit trails for every plugin-mediated action.

### 35. AI adoption scoring for engineering organizations
- Common pattern: at least some harness vendors are moving beyond spend dashboards toward management metrics that quantify how deeply AI is woven into day-to-day engineering workflows.
- Seen in: Kilo Code analytics plus AI Adoption Dashboard, including per-model and per-project usage breakdowns and a 0-100 adoption score split across frequency, depth, and coverage.
- Why it matters: once agent usage becomes a budget line and a process change, teams need to measure behavioral adoption and workflow integration rather than only token spend.
- One-shot build instruction:
  - Build an organization-facing browser-agent analytics surface that combines usage metrics with an adoption score across frequency, workflow depth, and team coverage, so leaders can see whether the harness is becoming operationally important or just occasionally sampled.

### 36. Closed-loop PR feedback learning and autonomous refinement
- Common pattern: some harnesses are beginning to treat review feedback as training signal for future agent behavior instead of as one-off human correction.
- Seen in: Roomote explicitly says it self-improves from PR feedback and keeps refining in the background with approval; Cursor learned rules and auto-fix behavior are adjacent signs that reviewer feedback is becoming a durable product input.
- Why it matters: browser and coding harnesses stay expensive and noisy if every reviewer correction dies inside one PR thread instead of becoming reusable policy, heuristics, or prompts for the next run.
- One-shot build instruction:
  - Add a reviewer-feedback learning loop for browser-agent work that captures accepted and rejected PR feedback, turns it into structured reusable guidance or heuristics after approval, replays it during planning and self-review, and lets operators inspect, edit, disable, or expire learned rules before they affect future runs.

### 37. Mode-scoped execution profiles and sticky task inheritance
- Common pattern: some harnesses now let teams bind execution profiles to specialized agent modes, then keep those profile choices stable across resumes, parallel work, and delegated subtasks.
- Seen in: Roo Code API Configuration Profiles can be pinned, linked to modes, and kept sticky per task; reopened tasks retain their original profile, multi-workspace runs avoid unexpected profile switches, and Orchestrator subtasks inherit the parent profile for their lifetime.
- Why it matters: multi-model harnesses become hard to trust when provider, model, or budget settings drift silently between planning, execution, resume, and delegation steps.
- One-shot build instruction:
  - Add execution profiles for browser-agent modes with explicit provider, model, thinking-budget, rate-limit, and tool-policy settings; let users bind profiles to agent roles, and keep a run's chosen profile sticky across resumes, child runs, worktrees, and remote execution unless a human explicitly changes it.

### 38. Deterministic workflow graphs around agent steps
- Common pattern: some harnesses are treating agents as nodes inside versioned workflows, with explicit deterministic steps, pause states, approvals, evaluations, and deployment-safe publishing around the agent core.
- Seen in: n8n AI Workflow Builder, AI Agent and Chat nodes, workflow-as-tool composition, per-tool human review, dataset-backed evaluations, and versioned publishing with rollback and concurrency protection.
- Why it matters: agent reliability improves when reasoning is embedded inside an inspectable workflow graph instead of being forced to carry branching logic, approvals, and recovery policy entirely inside the prompt.
- One-shot build instruction:
  - Add a workflow-graph orchestration layer for browser-agent work that composes deterministic steps, agent nodes, reusable workflow-tools, human approval checkpoints, evaluation nodes, and versioned publish or rollback semantics so long-running automations can be built, debugged, and governed as operational systems.

## Highest-signal opportunities for `agent-browser`

1. Multi-agent orchestration around browser tasks.
2. Persistent workflow memory plus inspectable project guidance.
3. Scheduled browser automations with inbox-style results.
4. A first-class skills/plugin package model for repeatable browser workflows.
5. Branch/diff/verification loops that join browser evidence with code changes.
6. Share review-safe run links for async debugging and handoff.
7. Add policy-driven permission presets for browser-capable agents.
8. Remote pairing plus traceable long-running browser sessions.
9. Background browser/code execution that does not steal the active editing surface.
10. Turn Linear-style boards into the control plane for browser-agent work.
11. Expose browser-agent runs through a typed SDK and durable run API.
12. Add durable interactive canvases for planning, debugging, and review.
13. Add a repo-owned workflow contract with live reload for browser-agent policy.
14. Ship operator-visible orchestration telemetry for long-running agent queues.
15. Build reusable remote execution environments plus trigger wiring for browser-agent automations.
16. Let browser agents build persistent in-app workspace surfaces.
17. Extract a reusable harness core for browser-agent-powered apps.
18. Add evaluation-native observability and live scorers for browser-agent runs.
19. Add trajectory critics and adaptive retry control to browser-agent runs.
20. Add benchmark-informed model routing for planning, execution, and verification.
21. Build review-native PR understanding for browser-agent changes.
22. Add built-in local inference for browser-agent sessions.
23. Add adversary-style tool-call review for browser-agent actions.
24. Add chaptered sessions and automatic context compression for browser-agent runs.
25. Add a policy-governed partner-agent control plane and model picker.
26. Add enterprise model governance, spend limits, and per-surface usage analytics.
27. Add specialized security review agents and scheduled vulnerability scans.
28. Add a runtime plugin layer with tool-call interception and event hooks.
29. Add AI adoption scoring alongside browser-agent usage analytics.
30. Add reviewer-feedback learning loops that refine future agent runs.
31. Bind model and provider profiles to agent roles, and keep them sticky across resumes and child runs.
32. Add workflow-graph orchestration that mixes deterministic steps, agent nodes, approvals, and versioned releases.
