# Agent Harness Competition Summary

Updated: 2026-05-24
Scope: `ChatGPT`, `Claude Code`, `Claude Cowork`, `Claude in Chrome`, `Cline`, `Codex`, `Conductor`, `Cursor`, `DeepSeek`, `DeerFlow`, `Devin`, `Gemini CLI`, `GitHub Copilot`, `Goose`, `Hermes Agent`, `Kilo Code`, `Kimi AI`, `Mastra`, `n8n`, `OpenAI Symphony`, `OpenClaw`, `OpenCode`, `Open Design`, `OpenHands`, `Pi`, `Roomote`, `Roo Code`, `Space Agent`, `T3 Code`, `Warp`
Method: current-product research from first-party product pages, help centers, docs, release notes, changelogs, and official project properties where available.

## Normalized feature themes

### 1. Parallel agent orchestration
- Common pattern: users supervise multiple isolated workers instead of a single chat thread.
- Seen in: Codex app multi-agent threads and worktrees, Claude Code subagents, Claude Cowork parallel workstreams, Cline subagents and parallel worktrees, Conductor parallel agents across isolated or shared workspaces, Cursor `/multitask` async subagents plus tiled agent management, DeerFlow planning and sub-tasking, Devin managed child sessions plus Advanced Mode parallel Devins, Gemini CLI subagents plus remote A2A delegation plus worktree-isolated sessions, Goose internal and external subagents with sequential and parallel execution, Hermes parallel sub-agents plus explicit orchestrator roles, Kimi AI Agent Swarm with a commander plus runtime-created specialists, Mastra supervisor coordination, OpenAI Symphony issue-to-agent orchestration, OpenClaw multi-agent workspaces, GitHub Copilot custom agents as subagents plus cloud agent plus third-party agents, OpenCode multi-session agents, Roo Code built-in Orchestrator plus cloud agent team, T3 Code worktree-aware thread spawning.
- Why it matters: once agent quality is acceptable, the UX bottleneck becomes coordination, not raw generation.
- One-shot build instruction:
  - Build a workspace-level orchestration surface that can launch multiple isolated agent runs against the same repo or task bundle, show per-agent state, preserve context separately, and support human steering, pause/resume, and compare/merge of outputs.

### 2. Persistent memory plus project instructions
- Common pattern: harnesses retain repo, workflow, and user preferences across runs.
- Seen in: Claude Code `CLAUDE.md` plus auto memory, ChatGPT project-only memory plus reusable project sources and Memory Sources controls, Cline Memory Bank, Copilot Memory with repo memory plus portable user preferences, DeerFlow long-term memory, Devin Knowledge with folders, triggers, macros, and suggestions, Gemini CLI layered `GEMINI.md` plus imports plus Auto Memory review inbox, Hermes bounded memory plus progressive `AGENTS.md` or `.hermes.md` discovery, Kimi Claw long-term memory and persona habits, Codex skills and team config, Cursor project rules plus memories plus `AGENTS.md` and commands, Conductor repo-owned `conductor.json` plus `files_to_copy` and `.worktreeinclude` bootstrap, OpenClaw workspace identity and config, OpenCode `AGENTS.md` project rules, Pi layered `AGENTS.md` or `CLAUDE.md` plus system-prompt files.
- Why it matters: repeated steering is turning into the main productivity tax.
- One-shot build instruction:
  - Add layered memory with explicit scopes (`workspace`, `project`, `user`, `agent`) and clear precedence, plus a memory inspector/editor so users can see, edit, import, disable, and diff what the harness has learned.

### 3. Skills, plugins, and reusable workflow packaging
- Common pattern: vendors are productizing repeatable agent behaviors as installable units.
- Seen in: Codex skills, Claude Cowork plugin marketplace, Claude Code custom commands, Cline skills and workflows, Copilot custom agents plus Agent Skills plus prompt files, Cursor commands plus plugin marketplaces, DeerFlow skills and Claude Code bridge, Devin Playbooks with macros, community sharing, and version history, Gemini CLI extensions packaging commands, prompts, tools, hooks, MCP config, subagents, themes, and policy, Goose recipes, subrecipes, recipe deeplinks, and recipe generator tooling, Hermes automated skill creation plus Curator lifecycle management plus runtime plugins and hooks, Mastra versioned skills and publish flow, Conductor personalities, skills, and repo-owned mode/config packaging, OpenClaw skills and plugins, OpenCode custom commands and agent definitions, Open Design cross-agent `SKILL.md` compatibility plus typed skill metadata and live parameter controls, OpenHands `AGENTS.md` plus `SKILL.md` progressive disclosure plus slash-menu discovery, Pi packages plus extensions, skills, prompts, and themes, Roo Code marketplace MCPs plus modes plus on-demand skills, Space Agent self-extending `SKILL.md` capabilities, T3 Code provider skill discovery, Warp Drive workflows plus repo-discovered skills that become schedulable cloud agents.
- Why it matters: durable workflows outperform ad hoc prompting for team adoption.
- One-shot build instruction:
  - Create a first-class workflow package format with metadata, prompts, scripts, permissions, test hooks, and share/install UX; include auto-suggestion of relevant skills during task intake.

### 4. Scheduled automations and background execution
- Common pattern: agents now run on schedules and return results later.
- Seen in: Codex Automations with local-versus-worktree background runs, triage inboxes, cron schedules, and thread automations, ChatGPT Tasks, ChatGPT workspace agents schedules, Claude Cowork scheduled tasks, Claude in Chrome scheduled shortcuts, Cursor background agents and Slack or web launch surfaces are adjacent here even when the trigger is human-initiated, Devin scheduled sessions plus automation history and notifications, Goose scheduled recipes with background execution and run history, Hermes scheduled automations plus Curator and cron watchdog flows, OpenClaw always-on agent framing, OpenHands Cloud automations with fresh sandboxes and resumable conversations, Warp scheduled cloud agents plus skill-targeted recurring runs in hosted environments.
- Why it matters: recurring operational work is a strong wedge for agent retention.
- One-shot build instruction:
  - Add a scheduler for one-off, recurring, and event-triggered jobs, with inbox-style results, retry history, last-run artifacts, and per-automation permissions.

### 5. Browser use and computer control
- Common pattern: harnesses are expanding from code and text to direct web and desktop action.
- Seen in: Codex in-app browser with visual comments, Browser plugin, and Computer Use plugin with per-app approvals, ChatGPT agent mode, Claude in Chrome, Claude Cowork computer use, Cline web tools and browser automation, Cursor browser controls plus layout editor plus debug mode, DeerFlow AIO sandbox, Devin interactive browser inside the progress workspace, Goose Computer Controller with web interaction and desktop GUI control, Hermes browser and web control, GitHub Copilot integrated browser tab sharing plus open-terminal control, Kimi WebBridge local browser control, Mastra browser providers with live Studio supervision, OpenClaw browser automation, Space Agent registered browser surfaces across popup and inline runtime widgets.
- Why it matters: many valuable workflows still terminate in websites or GUI tools rather than APIs.
- One-shot build instruction:
  - Ship a browser or desktop action layer that can inspect DOM, screenshots, console and network state, request confirmation for risky actions, and feed captured evidence back into the agent thread.

### 6. Multi-surface continuity
- Common pattern: users start in one surface and continue elsewhere.
- Seen in: Codex app + CLI + IDE + cloud + ChatGPT mobile remote host control, Claude Code terminal + web + JetBrains, ChatGPT web, mobile, desktop, and Slack, Claude Cowork desktop + phone thread, Cline editor + CLI, Copilot terminal + GitHub + mobile + Raycast + agents tab + VS Code with `/remote on` session continuity, Cursor desktop + web + mobile + Slack + cloud agents, DeerFlow IM channels, Goose desktop + CLI + API + ACP clients + mobile or Telegram remote access, Hermes chat apps + CLI + Android or Termux + local dashboard + ACP editors, Kimi web + mobile + desktop + Claw chat channels + linked OpenClaw instances, OpenClaw any messenger + local runtime, OpenCode terminal + desktop + IDE, Roomote Slack + web dashboard + Linear assignment + GitHub mentions, Roo Code IDE + web dashboard + GitHub + Slack, Space Agent browser runtime + native desktop app + self-hosted server, T3 Code remote pairing plus headless serve, Warp terminal + desktop app + browser-shared sessions + mobile-friendly Oz supervision.
- Why it matters: agents are becoming ambient systems, not point tools.
- One-shot build instruction:
  - Unify state across terminal, browser, desktop, mobile, and collaboration surfaces so the same run can be viewed, steered, and resumed anywhere without losing logs, artifacts, or permissions state.

### 7. Git/PR-native execution
- Common pattern: successful coding harnesses end in branches, diffs, and PRs rather than plain text.
- Seen in: Codex diff review plus GitHub `@codex review` and `@codex fix` loops, Claude Code git-native commits and PRs, Cline checkpoints and worktrees, Conductor issue-to-PR workspaces plus diff review plus checks gating, Copilot cloud agent branch and PR flow, Cursor Bugbot plus PR review flows plus SDK auto-PR support, Devin Review plus PR-linked bug catching, OpenAI Symphony proof-of-work packets and safe landing, OpenClaw development use cases, OpenHands issue and PR resolution through `fix-me` labels and `@openhands-agent` comments, Roomote PR-based delivery with self-review, merge-conflict handling, and visible diff-plus-artifact handoff, Roo Code Coder, Reviewer, and Fixer agent flow through GitHub.
- Why it matters: reviewable change sets are easier to trust than chat responses.
- One-shot build instruction:
  - Make code tasks branch-native: create isolated workspaces, show structured diffs, attach validation output, support inline review comments, and optionally open a PR when acceptance checks pass.

### 8. External tool connectivity and actionability
- Common pattern: harnesses increasingly connect to third-party tools, apps, or MCP servers.
- Seen in: Codex skills plus Linear issue delegation, GitHub review, and local Linear MCP connectivity, Claude Code MCP, ChatGPT apps plus synced knowledge sources plus upgraded action-capable app variants, Cline MCP marketplace and server builder, Copilot MCP plus cloud-agent REST task APIs plus IDE access to Spaces through GitHub MCP, Claude Cowork connectors and plugins, Cursor MCP Apps plus Bugbot MCP plus repo or issue actions, DeerFlow MCP servers, Devin tracker-native Linear and Jira control, Gemini CLI extensions and remote A2A services, Goose extensions and MCP, Hermes runtime plugins and gateways, Mastra MCP client and server roles, OpenClaw plugins, OpenCode MCP and custom tools, Open Design external MCP client support, OpenHands integrations across Git providers, Slack, and Jira, Roomote connected repos, docs, tickets, and logs, Roo Code marketplace MCPs, Space Agent browser or desktop runtime surfaces, T3 Code provider and skill discovery, Warp cloud integrations and MCP server management.
- Why it matters: the harness becomes much more valuable once it can turn conclusions into actions in the systems where teams already work.
- One-shot build instruction:
  - Build third-party connectivity as an action layer, not just a read-only context layer: support issue trackers, chat systems, deployment targets, docs, and MCP-style tool servers with clear permissions and observable results.

### 9. Hybrid local, worktree, and cloud execution portability
- Common pattern: the same task can move between local execution, isolated git copies, hosted runtimes, and remote supervision without resetting the thread.
- Seen in: Codex Local, Worktree, and Cloud modes plus IDE cloud handoff back to local and mobile remote host control, Conductor isolated workspaces plus issue-to-PR task intake, Cursor background or cloud-style agent work with local review, Roomote isolated cloud dev environments with PR delivery, Roo Code local worktrees plus cloud agents, Warp local terminal work plus cloud agents plus explicit `Fork to local` continuation from browser-viewed remote runs.
- Why it matters: teams want to choose the cheapest or safest execution environment per task without losing context, approvals, or reviewability.
- One-shot build instruction:
  - Build execution-mode portability so a run can start locally, move into an isolated worktree or cloud environment, and come back for local finishing while preserving thread history, approvals, artifacts, and diff context across every handoff.

### 10. Operator control consoles with blocked-state queues and durable usage ledgers
- Common pattern: long-running harnesses are turning live supervision into a first-class product surface instead of leaving operations buried in logs.
- Seen in: OpenAI Symphony dashboard detail panel, blocked-session surfacing, and per-issue token ledger API; Mastra Cloud dashboard plus observability and OTel-ready tracing; Roomote shared task console with transcript, diff, logs, and artifacts; T3 Code local trace observability; Kilo Code team analytics and adoption scoring; Warp agent session sharing, centralized management view, mobile Oz supervision, and per-run credit usage surfaces.
- Why it matters: once agents run for long periods, teams need to see what is running, what is blocked, what it is costing, and what needs human intervention without reconstructing the story from transcripts.
- One-shot build instruction:
  - Build an operator console that shows running and blocked sessions, current stage, checklist progress, recent events, and durable per-run token or cost ledgers; treat human-input blockers as a visible queue with explicit unblock actions instead of generic retries or hidden failures.

### 11. Searchable run history and cross-session debug recall
- Common pattern: harnesses are starting to make prior runs queryable instead of leaving history locked inside raw transcript archives.
- Seen in: GitHub Copilot `/chronicle` plus persisted agent debug logs and sortable sessions, OpenAI Symphony recent-activity dashboard panels and durable ledgers, T3 Code local trace observability, Pi session trees and exportable history, Roo Code shadow-git checkpoints plus context condensing.
- Why it matters: users need to recover what changed, why an earlier run failed, and which artifacts or files were touched without manually replaying the entire conversation.
- One-shot build instruction:
  - Add a searchable run chronicle that indexes sessions, touched files, commands, artifacts, and debug logs across local and remote runs, and let users query or filter that history from the main agent UI before reusing, diffing, or resuming prior work.

### 12. Steerable remote runs with local takeover
- Common pattern: remote agents are no longer fire-and-forget jobs; they stay open to inspection and follow-up, and users can adopt the work locally when remote execution ends.
- Seen in: Warp live browser-viewed cloud sessions plus follow-up prompts plus `Fork to local`, Codex local or worktree or cloud handoffs, Roomote shared task consoles with multi-user live steering, OpenAI Symphony operator detail panels with blocked-state intervention, GitHub Copilot cloud-agent continuity across GitHub and IDE surfaces.
- Why it matters: users want the scalability of background or hosted runs without giving up the ability to intervene, resume, or finish locally when the environment changes.
- One-shot build instruction:
  - Build remote-run handoff so a background, worktree, or cloud session can be opened live, steered with follow-up turns, and adopted into a local workspace with the same transcript, artifacts, approvals, and diff context preserved end to end.

### 13. Inspectable personalization provenance and source-level memory controls
- Common pattern: memory systems are starting to show users which prior context shaped an answer, then letting them directly adjust that context without digging through hidden settings.
- Seen in: ChatGPT Memory Sources with source chips for past chats, saved memories, custom instructions, files, and connected Gmail plus relevance feedback and deletion controls.
- Why it matters: trust in long-lived agent memory improves when users can see why a response was personalized and can immediately correct stale or low-signal context.
- One-shot build instruction:
  - Add response-level memory provenance chips that show which project notes, prior runs, instructions, files, or external sources shaped the current answer, and let users mark each source as relevant or not relevant, edit durable memories, or exclude the source from future personalization.

### 14. Background session supervisor views with peek-and-reply control
- Common pattern: long-running coding agents are now supervised through dedicated background-session views instead of forcing users to juggle raw terminals or wait for the final result.
- Seen in: Claude Code Agent View with active and completed background sessions plus peek and reply controls, Codex automations inbox plus remote follow-through, OpenAI Symphony dashboard detail panels and blocked-session queues, Roomote shared task console with live transcripts and artifacts, Warp centralized agent management plus live browser session supervision.
- Why it matters: once tasks run longer and split across multiple workers, users need a lightweight way to inspect progress, intervene, and unblock work without fully re-entering each execution environment.
- One-shot build instruction:
  - Build a background-session supervisor for `agent-browser` that lists active and completed runs, shows current stage and recent events, supports peek and follow-up reply actions, and exposes explicit blocked or needs-input states so users can steer a run without losing the main workspace context.

### 15. Split-trust execution planes with graceful sandbox fallback
- Common pattern: some harnesses are starting to separate low-risk host-native actions from higher-risk code execution instead of forcing every capability through one runtime boundary.
- Seen in: Claude Cowork host-native agent loop for file, web, and local plugin actions plus an isolated Linux VM for shell and code execution, with continued file-and-web operation when the VM is unavailable.
- Why it matters: users and admins want stronger isolation for shell execution without losing the rest of the harness when the sandbox is unavailable or more tightly governed.
- One-shot build instruction:
  - Split `agent-browser` execution into explicit action planes: keep chat, file inspection, browser work, and other host-safe actions in a host-native control layer with clear permissions, run shell and code execution in an isolated sandbox or worktree plane with separate network policy, surface which plane each action used, and gracefully degrade to host-safe actions when the sandbox is blocked or unavailable instead of failing the entire run.

### 16. Harness-managed subscription proxies and embeddable model endpoints
- Common pattern: some harnesses are starting to expose their authenticated model access and runtime as reusable local infrastructure for adjacent apps instead of keeping it trapped inside the primary chat UI.
- Seen in: Hermes subscription proxy for OpenAI-compatible apps with automatic upstream credential refresh, plus Hermes API server exposure for external clients and tool-capable backends.
- Why it matters: once a harness already owns provider auth, routing, policies, and observability, adjacent tools should be able to reuse that control plane without every app collecting its own keys or reimplementing model plumbing.
- One-shot build instruction:
  - Add a local OpenAI-compatible proxy and embeddable agent endpoint for `agent-browser` that can expose configured models or selected agent capabilities to approved external clients, reuse the harness's existing provider credentials and policy checks, refresh upstream auth when needed, and clearly separate "proxy a model" from "invoke the agent runtime" so external apps can integrate without duplicating secrets or execution logic.
