# Agent Harness Competition Summary

Updated: 2026-05-01
Scope: `ChatGPT`, `Claude Code`, `Claude Cowork`, `Claude in Chrome`, `Cline`, `Codex`, `Cursor`, `DeerFlow`, `GitHub Copilot`, `Hermes Agent`, `Mastra`, `OpenAI Symphony`, `OpenClaw`, `OpenCode`, `Pi`, `Space Agent`, `T3 Code`, `Warp`
Method: current-product research from first-party product pages, help centers, docs, release notes, and official project properties where available.

## Normalized feature themes

### 1. Parallel agent orchestration
- Common pattern: users supervise multiple isolated workers instead of a single chat thread.
- Seen in: Codex app multi-agent threads and worktrees, Claude Code subagents, Claude Cowork parallel workstreams, Cline subagents and parallel worktrees, Cursor `/multitask` async subagents plus tiled agent management, DeerFlow planning and sub-tasking, Hermes parallel sub-agents, Mastra supervisor coordination, OpenAI Symphony issue-to-agent orchestration, OpenClaw multi-agent workspaces, GitHub Copilot custom agents and cloud agent, OpenCode multi-session agents, T3 Code worktree-aware thread spawning.
- Why it matters: once agent quality is acceptable, the UX bottleneck becomes coordination, not raw generation.
- One-shot build instruction:
  - Build a workspace-level orchestration surface that can launch multiple isolated agent runs against the same repo or task bundle, show per-agent state, preserve context separately, and support human steering, pause/resume, and compare/merge of outputs.

### 2. Persistent memory plus project instructions
- Common pattern: harnesses retain repo, workflow, and user preferences across runs.
- Seen in: Claude Code `CLAUDE.md` plus auto memory, ChatGPT project memory, Cline Memory Bank, Copilot Memory, DeerFlow long-term memory, Hermes persistent memory, Codex skills/team config, Cursor project rules plus memories plus `AGENTS.md` and commands, OpenClaw workspace identity/config, OpenCode `AGENTS.md` project rules, Pi layered `AGENTS.md` or `CLAUDE.md` plus system-prompt files.
- Why it matters: repeated steering is turning into the main productivity tax.
- One-shot build instruction:
  - Add layered memory with explicit scopes (`workspace`, `project`, `user`, `agent`) and clear precedence, plus a memory inspector/editor so users can see, edit, import, disable, and diff what the harness has learned.

### 3. Skills, plugins, and reusable workflow packaging
- Common pattern: vendors are productizing repeatable agent behaviors as installable units.
- Seen in: Codex skills, Claude Cowork plugin marketplace, Claude Code custom commands, Cline skills and workflows, Copilot custom agents and skills, Cursor commands plus plugin marketplaces, DeerFlow skills and Claude Code bridge, Hermes automated skill creation, Mastra versioned skills and publish flow, OpenClaw skills and plugins, OpenCode custom commands and agent definitions, Pi packages plus extensions/skills/prompts/themes, Space Agent self-extending `SKILL.md` capabilities, T3 Code provider skill discovery.
- Why it matters: durable workflows outperform ad hoc prompting for team adoption.
- One-shot build instruction:
  - Create a first-class workflow package format with metadata, prompts, scripts, permissions, test hooks, and share/install UX; include auto-suggestion of relevant skills during task intake.

### 4. Scheduled automations and background execution
- Common pattern: agents now run on schedules and return results later.
- Seen in: Codex Automations, ChatGPT Tasks, ChatGPT workspace agents schedules, Claude Cowork scheduled tasks, Claude in Chrome scheduled shortcuts, Cursor background agents and Slack/web launch surfaces are adjacent here even when the trigger is human-initiated, Hermes scheduled automations, OpenClaw always-on agent framing.
- Why it matters: recurring operational work is a strong wedge for agent retention.
- One-shot build instruction:
  - Add a scheduler for one-off, recurring, and event-triggered jobs, with inbox-style results, retry history, last-run artifacts, and per-automation permissions.

### 5. Browser use and computer control
- Common pattern: harnesses are expanding from code/text to direct web and desktop action.
- Seen in: ChatGPT agent mode, Claude in Chrome, Claude Cowork computer use, Cline web tools and browser automation, Cursor browser controls plus layout editor plus debug mode, DeerFlow AIO sandbox, Hermes browser/web control, Mastra browser providers with live Studio supervision, OpenClaw browser automation, Space Agent registered browser surfaces across popup and inline runtime widgets.
- Why it matters: many valuable workflows still terminate in websites or GUI tools rather than APIs.
- One-shot build instruction:
  - Ship a browser/desktop action layer that can inspect DOM, screenshots, console and network state, request confirmation for risky actions, and feed captured evidence back into the agent thread.

### 6. Multi-surface continuity
- Common pattern: users start in one surface and continue elsewhere.
- Seen in: Codex app + CLI + IDE + cloud, Claude Code terminal + web + JetBrains, ChatGPT web/mobile/desktop/Slack, Claude Cowork desktop + phone thread, Cline editor + CLI, Copilot terminal + GitHub + mobile, Cursor desktop + web + mobile + Slack + cloud agents, DeerFlow IM channels, Hermes chat apps + CLI, OpenClaw any messenger + local runtime, OpenCode terminal + desktop + IDE, Space Agent browser runtime + native desktop app + self-hosted server, T3 Code remote pairing plus headless serve.
- Why it matters: agents are becoming ambient systems, not point tools.
- One-shot build instruction:
  - Unify state across terminal, browser, desktop, mobile, and collaboration surfaces so the same run can be viewed, steered, and resumed anywhere without losing logs, artifacts, or permissions state.

### 7. Git/PR-native execution
- Common pattern: successful coding harnesses end in branches, diffs, and PRs rather than plain text.
- Seen in: Codex diff review, Claude Code git-native commits/PRs, Cline checkpoints and worktrees, Copilot cloud agent branch/PR flow, Cursor Bugbot plus PR review flows plus SDK auto-PR support, OpenAI Symphony proof-of-work packets and safe landing, OpenClaw development use cases.
- Why it matters: reviewable change sets are easier to trust than chat responses.
- One-shot build instruction:
  - Make code tasks branch-native: create isolated workspaces, show structured diffs, attach validation output, support inline review comments, and optionally open a PR when acceptance checks pass.

### 8. External tool connectivity and actionability
- Common pattern: harnesses increasingly connect to third-party tools, apps, or MCP servers.
- Seen in: Codex skills for Linear/Figma/cloud hosts, Claude Code MCP, ChatGPT apps, Cline MCP marketplace and server builder, Copilot MCP, Claude Cowork connectors/plugins, Cursor MCP Apps plus Bugbot MCP plus plugin marketplaces, DeerFlow MCP servers and InfoQuest, Hermes multi-provider integrations, Mastra MCP client/server plus approval flow, OpenAI Symphony `linear_graphql` tool bridge, OpenClaw integrations, OpenCode MCP servers and custom tools.
- Why it matters: standalone agents plateau quickly without live context or write access.
- One-shot build instruction:
  - Build a secure tool-connectivity layer with read/write scopes, audited invocation logs, secret isolation, per-skill tool policies, and reusable integrations for issue trackers, docs, storage, and deploy targets.

### 9. Shared team agents and governance
- Common pattern: products are moving from personal assistants to organization-shared agents.
- Seen in: ChatGPT workspace agents, Claude Cowork admin controls and analytics, Cline enterprise-managed skills, Copilot enterprise controls, Codex team-configured skills, Cursor team marketplaces plus team permissions on cloud agents, Space Agent user/group layers with admin control plane and shared customware.
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
- Seen in: DeerFlow Telegram/Slack/Feishu/WeChat/WeCom channels, OpenClaw chat-app-everywhere interface, Hermes multi-platform gateway, Claude Cowork phone-managed persistent thread.
- Why it matters: task intake and follow-up often happen where teams already communicate, not where the harness was originally launched.
- One-shot build instruction:
  - Add chat-native ingress for supported channels with per-channel auth, thread/session mapping, slash-style commands, file handoff, and safe routing into existing agent runs without fragmenting history.

### 12. Shareable sessions and debug handoff
- Common pattern: harnesses increasingly let users publish a run artifact that others can inspect without replaying the whole session locally.
- Seen in: OpenCode share links, GitHub Copilot cloud logs and PR sessions, Codex thread sharing and review surfaces, Cursor web share links plus desktop handoff, Pi private gist sharing plus public OSS session publishing.
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
- Seen in: Cline Background Edit plus background terminal execution, Claude in Chrome background workflows, Cursor background agents, ChatGPT scheduled/background runs.
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
- Seen in: OpenAI Symphony structured logs, optional status surface, Phoenix dashboard, and `/api/v1/*` observability endpoints.
- Why it matters: once a harness runs continuously across many issues, operator trust depends on inspectable health, queue, retry, and session state.
- One-shot build instruction:
  - Build an operator telemetry surface for browser-agent orchestration with structured logs, queue and session views, issue-specific debug pages, and a read-mostly JSON API that supports refresh triggers and postmortem inspection.

### 18. Embeddable agent runtimes and protocol surfaces
- Common pattern: some harnesses are no longer just end-user apps and are instead exposing stable runtime layers other products can embed directly.
- Seen in: Pi interactive plus print/JSON plus JSON-RPC plus SDK modes, Cursor SDK plus durable Cloud Agents API, OpenAI Symphony operator APIs, T3 Code headless serve, and GitHub Copilot's growing cross-surface agent presence.
- Why it matters: product teams increasingly want the same agent core available in the terminal, in the browser, in IDEs, and inside orchestrators without re-implementing session, transport, and tool behavior each time.
- One-shot build instruction:
  - Expose browser-agent sessions through a reusable runtime contract with both in-process and subprocess transports, including a typed SDK, a documented streaming protocol, request correlation, session lifecycle controls, and enough stability that other internal surfaces can embed the harness instead of screen-scraping it.

### 19. Agent-ready remote environments and trigger wiring
- Common pattern: hosted agent systems are increasingly packaging reusable execution environments together with triggers from issue trackers, chat systems, and CI so automation can start from live business events instead of a local terminal.
- Seen in: Warp Cloud Agents with reusable setup plus GitHub, Linear, Slack, scheduled runs, and GitHub Actions triggers; OpenAI Symphony isolated issue workspaces and workflow hooks are adjacent from the orchestration side.
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
- Seen in: Cursor canvases in the Agents Window, MCP Apps rendered inside chats, and Space Agent task-built widgets and pages.
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
- Seen in: Mastra Observability plus Scorers plus Studio experiments most explicitly; OpenAI Symphony proof-of-work packets and operator telemetry are adjacent from the orchestration side.
- Why it matters: once agents run continuously, teams need to see not only what happened, but whether quality, safety, and tool behavior are drifting over time.
- One-shot build instruction:
  - Add evaluation-native observability for browser agents with trace capture, live scorer hooks, experiment datasets, issue-linked regression views, and operator dashboards that connect run evidence to quality signals.

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

## Notes
- This pass extends the earlier seventeen-harness corpus with `Mastra` as an eighteenth competitor.
- Screenshot-heavy official assets were linked at the source-page level rather than copied into the repo during this pass.
