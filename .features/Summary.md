# Agent Harness Competition Summary

Updated: 2026-04-28
Scope: `Codex`, `ChatGPT`, `Claude Code`, `Claude Cowork`, `Claude in Chrome`, `DeerFlow`, `GitHub Copilot`, `Hermes Agent`, `OpenClaw`, `OpenCode`
Method: current-product research from first-party product pages, help centers, docs, and official project properties where available.

## Normalized feature themes

### 1. Parallel agent orchestration
- Common pattern: users supervise multiple isolated workers instead of a single chat thread.
- Seen in: Codex app multi-agent threads and worktrees, Claude Code subagents, Claude Cowork parallel workstreams, DeerFlow planning and sub-tasking, Hermes parallel sub-agents, OpenClaw multi-agent workspaces, GitHub Copilot custom agents and cloud agent, OpenCode multi-session agents.
- Why it matters: once agent quality is acceptable, the UX bottleneck becomes coordination, not raw generation.
- One-shot build instruction:
  - Build a workspace-level orchestration surface that can launch multiple isolated agent runs against the same repo or task bundle, show per-agent state, preserve context separately, and support human steering, pause/resume, and compare/merge of outputs.

### 2. Persistent memory plus project instructions
- Common pattern: harnesses retain repo, workflow, and user preferences across runs.
- Seen in: Claude Code `CLAUDE.md` plus auto memory, ChatGPT project memory, Copilot Memory, DeerFlow long-term memory, Hermes persistent memory, Codex skills/team config, OpenClaw workspace identity/config, OpenCode `AGENTS.md` project rules.
- Why it matters: repeated steering is turning into the main productivity tax.
- One-shot build instruction:
  - Add layered memory with explicit scopes (`workspace`, `project`, `user`, `agent`) and clear precedence, plus a memory inspector/editor so users can see, edit, import, disable, and diff what the harness has learned.

### 3. Skills, plugins, and reusable workflow packaging
- Common pattern: vendors are productizing repeatable agent behaviors as installable units.
- Seen in: Codex skills, Claude Cowork plugin marketplace, Claude Code custom commands, Copilot custom agents and skills, DeerFlow skills and Claude Code bridge, Hermes automated skill creation, OpenClaw skills and plugins, OpenCode custom commands and agent definitions.
- Why it matters: durable workflows outperform ad hoc prompting for team adoption.
- One-shot build instruction:
  - Create a first-class workflow package format with metadata, prompts, scripts, permissions, test hooks, and share/install UX; include auto-suggestion of relevant skills during task intake.

### 4. Scheduled automations and background execution
- Common pattern: agents now run on schedules and return results later.
- Seen in: Codex Automations, ChatGPT Tasks, ChatGPT workspace agents schedules, Claude Cowork scheduled tasks, Claude in Chrome scheduled shortcuts, Hermes scheduled automations, OpenClaw always-on agent framing.
- Why it matters: recurring operational work is a strong wedge for agent retention.
- One-shot build instruction:
  - Add a scheduler for one-off, recurring, and event-triggered jobs, with inbox-style results, retry history, last-run artifacts, and per-automation permissions.

### 5. Browser use and computer control
- Common pattern: harnesses are expanding from code/text to direct web and desktop action.
- Seen in: ChatGPT agent mode, Claude in Chrome, Claude Cowork computer use, DeerFlow AIO sandbox, Hermes browser/web control, OpenClaw browser automation.
- Why it matters: many valuable workflows still terminate in websites or GUI tools rather than APIs.
- One-shot build instruction:
  - Ship a browser/desktop action layer that can inspect DOM, screenshots, console and network state, request confirmation for risky actions, and feed captured evidence back into the agent thread.

### 6. Multi-surface continuity
- Common pattern: users start in one surface and continue elsewhere.
- Seen in: Codex app + CLI + IDE + cloud, Claude Code terminal + web + JetBrains, ChatGPT web/mobile/desktop/Slack, Claude Cowork desktop + phone thread, Copilot terminal + GitHub + mobile, DeerFlow IM channels, Hermes chat apps + CLI, OpenClaw any messenger + local runtime, OpenCode terminal + desktop + IDE.
- Why it matters: agents are becoming ambient systems, not point tools.
- One-shot build instruction:
  - Unify state across terminal, browser, desktop, mobile, and collaboration surfaces so the same run can be viewed, steered, and resumed anywhere without losing logs, artifacts, or permissions state.

### 7. Git/PR-native execution
- Common pattern: successful coding harnesses end in branches, diffs, and PRs rather than plain text.
- Seen in: Codex diff review, Claude Code git-native commits/PRs, Copilot cloud agent branch/PR flow, OpenClaw development use cases.
- Why it matters: reviewable change sets are easier to trust than chat responses.
- One-shot build instruction:
  - Make code tasks branch-native: create isolated workspaces, show structured diffs, attach validation output, support inline review comments, and optionally open a PR when acceptance checks pass.

### 8. External tool connectivity and actionability
- Common pattern: harnesses increasingly connect to third-party tools, apps, or MCP servers.
- Seen in: Codex skills for Linear/Figma/cloud hosts, Claude Code MCP, ChatGPT apps, Copilot MCP, Claude Cowork connectors/plugins, DeerFlow MCP servers and InfoQuest, Hermes multi-provider integrations, OpenClaw integrations, OpenCode MCP servers and custom tools.
- Why it matters: standalone agents plateau quickly without live context or write access.
- One-shot build instruction:
  - Build a secure tool-connectivity layer with read/write scopes, audited invocation logs, secret isolation, per-skill tool policies, and reusable integrations for issue trackers, docs, storage, and deploy targets.

### 9. Shared team agents and governance
- Common pattern: products are moving from personal assistants to organization-shared agents.
- Seen in: ChatGPT workspace agents, Claude Cowork admin controls and analytics, Copilot enterprise controls, Codex team-configured skills.
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
- Seen in: OpenCode share links, GitHub Copilot cloud logs and PR sessions, Codex thread sharing and review surfaces.
- Why it matters: async debugging and review improve when the run itself is a portable artifact rather than an anecdote.
- One-shot build instruction:
  - Add review-safe run sharing that publishes a sanitized session artifact with transcript, artifacts, diff links, and verification evidence, plus retention controls and a clear private-by-default policy.

## Highest-signal opportunities for `agent-browser`

1. Multi-agent orchestration around browser tasks.
2. Persistent workflow memory plus inspectable project guidance.
3. Scheduled browser automations with inbox-style results.
4. A first-class skills/plugin package model for repeatable browser workflows.
5. Branch/diff/verification loops that join browser evidence with code changes.
6. Share review-safe run links for async debugging and handoff.
7. Add policy-driven permission presets for browser-capable agents.

## Notes
- This pass extends the earlier nine-harness corpus with `OpenCode` as a tenth competitor.
- Screenshot-heavy official assets were linked at the source-page level rather than copied into the repo during this pass.
