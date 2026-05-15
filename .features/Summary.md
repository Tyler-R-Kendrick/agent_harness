# Agent Harness Competition Summary

Updated: 2026-05-15
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
- Seen in: Claude Code `CLAUDE.md` plus auto memory, ChatGPT project memory, Cline Memory Bank, Copilot Memory, DeerFlow long-term memory, Devin Knowledge with folders, triggers, macros, and suggestions, Gemini CLI layered `GEMINI.md` plus imports plus Auto Memory review inbox, Hermes bounded memory plus progressive `AGENTS.md` or `.hermes.md` discovery, Kimi Claw long-term memory and persona habits, Codex skills/team config, Cursor project rules plus memories plus `AGENTS.md` and commands, Conductor repo-owned `conductor.json` plus `files_to_copy` and `.worktreeinclude` bootstrap, OpenClaw workspace identity/config, OpenCode `AGENTS.md` project rules, Pi layered `AGENTS.md` or `CLAUDE.md` plus system-prompt files.
- Why it matters: repeated steering is turning into the main productivity tax.
- One-shot build instruction:
  - Add layered memory with explicit scopes (`workspace`, `project`, `user`, `agent`) and clear precedence, plus a memory inspector/editor so users can see, edit, import, disable, and diff what the harness has learned.

### 3. Skills, plugins, and reusable workflow packaging
- Common pattern: vendors are productizing repeatable agent behaviors as installable units.
- Seen in: Codex skills, Claude Cowork plugin marketplace, Claude Code custom commands, Cline skills and workflows, Copilot custom agents plus Agent Skills plus prompt files, Cursor commands plus plugin marketplaces, DeerFlow skills and Claude Code bridge, Devin Playbooks with macros, community sharing, and version history, Gemini CLI extensions packaging commands, prompts, tools, hooks, MCP config, subagents, themes, and policy, Goose recipes, subrecipes, recipe deeplinks, and recipe generator tooling, Hermes automated skill creation plus Curator lifecycle management plus runtime plugins and hooks, Mastra versioned skills and publish flow, Conductor personalities, skills, and repo-owned mode/config packaging, OpenClaw skills and plugins, OpenCode custom commands and agent definitions, Open Design cross-agent `SKILL.md` compatibility plus typed skill metadata and live parameter controls, OpenHands `AGENTS.md` plus `SKILL.md` progressive disclosure plus slash-menu discovery, Pi packages plus extensions/skills/prompts/themes, Roo Code marketplace MCPs plus modes plus on-demand skills, Space Agent self-extending `SKILL.md` capabilities, T3 Code provider skill discovery.
- Why it matters: durable workflows outperform ad hoc prompting for team adoption.
- One-shot build instruction:
  - Create a first-class workflow package format with metadata, prompts, scripts, permissions, test hooks, and share/install UX; include auto-suggestion of relevant skills during task intake.

### 4. Scheduled automations and background execution
- Common pattern: agents now run on schedules and return results later.
- Seen in: Codex Automations, ChatGPT Tasks, ChatGPT workspace agents schedules, Claude Cowork scheduled tasks, Claude in Chrome scheduled shortcuts, Cursor background agents and Slack/web launch surfaces are adjacent here even when the trigger is human-initiated, Devin scheduled sessions plus automation history and notifications, Goose scheduled recipes with background execution and run history, Hermes scheduled automations plus Curator and cron watchdog flows, OpenClaw always-on agent framing, OpenHands Cloud automations with fresh sandboxes and resumable conversations.
- Why it matters: recurring operational work is a strong wedge for agent retention.
- One-shot build instruction:
  - Add a scheduler for one-off, recurring, and event-triggered jobs, with inbox-style results, retry history, last-run artifacts, and per-automation permissions.

### 5. Browser use and computer control
- Common pattern: harnesses are expanding from code/text to direct web and desktop action.
- Seen in: ChatGPT agent mode, Claude in Chrome, Claude Cowork computer use, Cline web tools and browser automation, Cursor browser controls plus layout editor plus debug mode, DeerFlow AIO sandbox, Devin interactive browser inside the progress workspace, Goose Computer Controller with web interaction and desktop GUI control, Hermes browser/web control, Kimi WebBridge local browser control, Mastra browser providers with live Studio supervision, OpenClaw browser automation, Space Agent registered browser surfaces across popup and inline runtime widgets.
- Why it matters: many valuable workflows still terminate in websites or GUI tools rather than APIs.
- One-shot build instruction:
  - Ship a browser/desktop action layer that can inspect DOM, screenshots, console and network state, request confirmation for risky actions, and feed captured evidence back into the agent thread.

### 6. Multi-surface continuity
- Common pattern: users start in one surface and continue elsewhere.
- Seen in: Codex app + CLI + IDE + cloud, Claude Code terminal + web + JetBrains, ChatGPT web/mobile/desktop/Slack, Claude Cowork desktop + phone thread, Cline editor + CLI, Copilot terminal + GitHub + mobile + Raycast + agents tab + VS Code, Cursor desktop + web + mobile + Slack + cloud agents, DeerFlow IM channels, Goose desktop + CLI + API + ACP clients + mobile or Telegram remote access, Hermes chat apps + CLI + Android/Termux + local dashboard + ACP editors, Kimi web + mobile + desktop + Claw chat channels + linked OpenClaw instances, OpenClaw any messenger + local runtime, OpenCode terminal + desktop + IDE, Roomote Slack + web dashboard + Linear assignment + GitHub mentions, Roo Code IDE + web dashboard + GitHub + Slack, Space Agent browser runtime + native desktop app + self-hosted server, T3 Code remote pairing plus headless serve.
- Why it matters: agents are becoming ambient systems, not point tools.
- One-shot build instruction:
  - Unify state across terminal, browser, desktop, mobile, and collaboration surfaces so the same run can be viewed, steered, and resumed anywhere without losing logs, artifacts, or permissions state.

### 7. Git/PR-native execution
- Common pattern: successful coding harnesses end in branches, diffs, and PRs rather than plain text.
- Seen in: Codex diff review, Claude Code git-native commits/PRs, Cline checkpoints and worktrees, Conductor issue-to-PR workspaces plus diff review plus checks gating, Copilot cloud agent branch/PR flow, Cursor Bugbot plus PR review flows plus SDK auto-PR support, Devin Review plus PR-linked bug catching, OpenAI Symphony proof-of-work packets and safe landing, OpenClaw development use cases, OpenHands issue and PR resolution through `fix-me` labels and `@openhands-agent` comments, Roomote PR-based delivery with self-review, merge-conflict handling, and visible diff-plus-artifact handoff, Roo Code Coder/Reviewer/Fixer agent flow through GitHub.
- Why it matters: reviewable change sets are easier to trust than chat responses.
- One-shot build instruction:
  - Make code tasks branch-native: create isolated workspaces, show structured diffs, attach validation output, support inline review comments, and optionally open a PR when acceptance checks pass.

### 8. External tool connectivity and actionability
- Common pattern: harnesses increasingly connect to third-party tools, apps, or MCP servers.
- Seen in: Codex skills for Linear/Figma/cloud hosts, Claude Code MCP, ChatGPT apps, Cline MCP marketplace and server builder, Copilot MCP, Claude Cowork connectors/plugins, Cursor MCP Apps plus Bugbot MCP plus 