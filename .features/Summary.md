# Agent Harness Competition Summary

Updated: 2026-06-02
Scope: `ChatGPT`, `Claude Code`, `Claude Cowork`, `Claude in Chrome`, `Cline`, `Codex`, `Conductor`, `Cursor`, `DeepSeek`, `DeerFlow`, `Devin`, `Gemini CLI`, `GitHub Copilot`, `Goose`, `Hermes Agent`, `Kilo Code`, `Kimi AI`, `Mastra`, `n8n`, `OpenAI Symphony`, `OpenClaw`, `OpenCode`, `Open Design`, `OpenHands`, `Pi`, `Roomote`, `Roo Code`, `Space Agent`, `T3 Code`, `Warp`
Method: current-product research from first-party product pages, help centers, docs, release notes, changelogs, and official project properties where available.

## Normalized feature themes

### 1. Parallel agent orchestration
- Common pattern: users supervise multiple isolated workers instead of a single chat thread.
- Seen in: Codex app multi-agent threads and worktrees, Claude Code subagents, Claude Cowork parallel workstreams, Cline subagents and parallel worktrees, Conductor parallel agents across isolated or shared workspaces, Cursor `/multitask` async subagents plus tiled agent management, DeerFlow planning and sub-tasking, Devin managed child sessions plus Advanced Mode parallel Devins, Gemini CLI subagents plus remote A2A delegation plus worktree-isolated sessions, Goose internal and external subagents with sequential and parallel execution, Hermes parallel sub-agents plus explicit orchestrator roles, Kimi AI Agent Swarm with a commander plus runtime-created specialists and Claw Groups shared workspaces for heterogeneous agents, Mastra supervisor coordination, OpenAI Symphony issue-to-agent orchestration, OpenClaw multi-agent workspaces, GitHub Copilot custom agents as subagents plus cloud agent plus third-party agents, OpenCode multi-session agents, Roo Code built-in Orchestrator plus cloud agent team, T3 Code worktree-aware thread spawning.
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
- Seen in: Codex skills, Claude Cowork plugin marketplace, Claude Code custom commands, Cline skills and workflows, Copilot custom agents plus Agent Skills plus prompt files, Cursor commands plus plugin marketplaces, DeerFlow skills and Claude Code bridge, Devin Playbooks with macros, community sharing, and version history, Gemini CLI extensions packaging commands, prompts, tools, hooks, MCP config, subagents, themes, and policy, Goose recipes, subrecipes, recipe deeplinks, and recipe generator tooling, Hermes automated skill creation plus Curator lifecycle management plus runtime plugins and hooks, Kimi AI document-to-skills conversion plus open-source skill hubs plus reusable skill application across Agent, Kimi Code, and Kimi Claw, Mastra versioned skills and publish flow, Conductor personalities, skills, and repo-owned mode/config packaging, OpenClaw layered skill roots plus Skill Workshop plus typed plugin SDK tooling, OpenCode custom commands and agent definitions, Open Design cross-agent `SKILL.md` compatibility plus typed skill metadata and live parameter controls, OpenHands `AGENTS.md` plus `SKILL.md` progressive disclosure plus slash-menu discovery, Pi packages plus extensions, skills, prompts, and themes, Roo Code marketplace MCPs plus modes plus on-demand skills, Space Agent self-extending `SKILL.md` capabilities, T3 Code provider skill discovery, Warp Drive workflows plus repo-discovered skills that become schedulable cloud agents.
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
- Seen in: Codex in-app browser with visual comments, advanced annotations, read-only JavaScript context, Browser plugin, and Computer Use across Mac and Windows hosts with per-app approvals and locked-host follow-through, ChatGPT agent mode, Claude in Chrome, Claude Cowork computer use, Cline web tools and browser automation, Cursor browser controls plus layout editor plus debug mode, DeerFlow AIO sandbox, Devin interactive browser inside the progress workspace, Goose Computer Controller with web interaction and desktop GUI control, Hermes browser and web control, GitHub Copilot integrated browser tab sharing plus open-terminal control, Kimi WebBridge local browser control, Mastra browser providers with live Studio supervision, OpenClaw managed browser profiles plus real-user-profile attachment and dialog-aware actions, Space Agent registered browser surfaces across popup and inline runtime widgets.
- Why it matters: many valuable workflows still terminate in websites or GUI tools rather than APIs.
- One-shot build instruction:
  - Ship a browser or desktop action layer that can inspect DOM, screenshots, console and network state, request confirmation for risky actions, and feed captured evidence back into the agent thread.

### 6. Multi-surface continuity
- Common pattern: users start in one surface and continue elsewhere.
- Seen in: Codex app + CLI + IDE + cloud + ChatGPT mobile remote host control with live thread state, approvals, model changes, plugins, and Windows-host follow-through, Claude Code terminal + web + JetBrains, ChatGPT web, mobile, desktop, and Slack, Claude Cowork desktop + phone thread, Cline editor + CLI, Copilot terminal + GitHub + mobile + Raycast + agents tab + VS Code with `/remote on` session continuity, Cursor desktop + web + mobile + Slack + cloud agents, DeerFlow IM channels, Goose desktop + CLI + API + ACP clients + mobile or Telegram remote access, Hermes chat apps + CLI + Android or Termux + local dashboard + ACP editors, Kimi web + mobile + desktop + Kimi Code CLI + VS Code + Claw chat channels + linked OpenClaw instances + third-party coding-agent reuse, OpenClaw any messenger + local runtime plus browser dashboard, WebChat, remote SSH clients, and macOS/iOS/Android nodes, OpenCode terminal + desktop + IDE, Roomote Slack + web dashboard + Linear assignment + GitHub mentions, Roo Code IDE + web dashboard + GitHub + Slack, Space Agent browser runtime + native desktop app + self-hosted server, T3 Code remote pairing plus headless serve, Warp terminal + desktop app + browser-shared sessions + mobile-friendly Oz supervision.
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
- Seen in: Codex skills plus Linear issue delegation, GitHub review, and local Linear MCP connectivity, Claude Code MCP, ChatGPT apps plus synced knowledge sources plus upgraded action-capable app variants, Cline MCP marketplace and server builder, Copilot MCP plus cloud-agent REST task APIs plus IDE access to Spaces through GitHub MCP, Claude Cowork connectors and plugins, Cursor MCP Apps plus Bugbot MCP plus repo or issue actions, DeerFlow MCP servers, Devin tracker-native Linear and Jira control, Gemini CLI extensions and remote A2A services, Goose extensions and MCP, Hermes runtime plugins and gateways, Mastra MCP client and server roles, OpenClaw plugins plus ACP harness adapters and typed tool-plugin helpers, OpenCode MCP and custom tools, Open Design external MCP client support, OpenHands integrations across Git providers, Slack, and Jira, Roomote connected repos, docs, tickets, and logs, Roo Code marketplace MCPs, Space Agent browser or desktop runtime surfaces, T3 Code provider and skill discovery, Warp cloud integrations and MCP server management.
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
- Seen in: OpenAI Symphony dashboard detail panel, blocked-session surfacing, and per-issue token ledger API; Codex Profiles with identity, activity history, usage stats, and token activity surfaces; OpenClaw Control UI plus dashboard session and config surfaces plus durable background task records and a Workboard card layer linked to tasks, sessions, proof, and worker dispatch; Mastra Cloud dashboard plus observability and OTel-ready tracing; Roomote shared task console with transcript, diff, logs, and artifacts; T3 Code local trace observability; Kilo Code team analytics and adoption scoring; Warp agent session sharing, centralized management view, mobile Oz supervision, and per-run credit usage surfaces.
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

### 13. Queued steering with visible progress drafts
- Common pattern: newer harnesses are making interruption and follow-up semantics explicit instead of leaving users to guess how a running turn will absorb new input.
- Seen in: OpenClaw queue modes plus progress drafts, Space Agent queued steering at the turn boundary, Roo Code queued steering and context condensing, and Warp live follow-up prompts into still-running or still-open remote sessions.
- Why it matters: once runs are longer, more tool-heavy, or more remote, the product needs a precise contract for when human input interrupts, queues, coalesces, or simply annotates the active work.
- One-shot build instruction:
  - Add explicit in-flight steering controls with per-session queue modes, turn-boundary interrupt semantics, debounce and overflow policies, and one visible progress-draft surface that updates during real work instead of spamming transient status messages.

### 14. Inspectable personalization provenance and source-level memory controls
- Common pattern: memory systems are starting to show users which prior context shaped an answer, then letting them directly adjust that context without digging through hidden settings.
- Seen in: ChatGPT Memory Sources with source chips for past chats, saved memories, custom instructions, files, and connected Gmail plus relevance feedback and deletion controls.
- Why it matters: trust in long-lived agent memory improves when users can see why a response was personalized and can immediately correct stale or low-signal context.
- One-shot build instruction:
  - Add response-level memory provenance chips that show which project notes, prior runs, instructions, files, or external sources shaped the current answer, and let users mark each source as relevant or not relevant, edit durable memories, or exclude the source from future personalization.

### 15. Background session supervisor views with peek-and-reply control
- Common pattern: long-running coding agents are now supervised through dedicated background-session views instead of forcing users to juggle raw terminals or wait for the final result.
- Seen in: Claude Code Agent View with active and completed background sessions plus peek and reply controls, Codex automations inbox plus remote follow-through, OpenAI Symphony dashboard detail panels and blocked-session queues, Roomote shared task console with live transcripts and artifacts, Warp centralized agent management plus live browser session supervision.
- Why it matters: once tasks run longer and split across multiple workers, users need a lightweight way to inspect progress, intervene, and unblock work without fully re-entering each execution environment.
- One-shot build instruction:
  - Build a background-session supervisor for `agent-browser` that lists active and completed runs, shows current stage and recent events, supports peek and follow-up reply actions, and exposes explicit blocked or needs-input states so users can steer a run without losing the main workspace context.

### 16. Split-trust execution planes with graceful sandbox fallback
- Common pattern: some harnesses are starting to separate low-risk host-native actions from higher-risk code execution instead of forcing every capability through one runtime boundary.
- Seen in: Claude Cowork host-native agent loop for file, web, and local plugin actions plus an isolated Linux VM for shell and code execution, with continued file-and-web operation when the VM is unavailable.
- Why it matters: users and admins want stronger isolation for shell execution without losing the rest of the harness when the sandbox is unavailable or more tightly governed.
- One-shot build instruction:
  - Split `agent-browser` execution into explicit action planes: keep chat, file inspection, browser work, and other host-safe actions in a host-native control layer with clear permissions, run shell and code execution in an isolated sandbox or worktree plane with separate network policy, surface which plane each action used, and gracefully degrade to host-safe actions when the sandbox is blocked or unavailable instead of failing the entire run.

### 17. Harness-managed subscription proxies and embeddable model endpoints
- Common pattern: some harnesses are starting to expose their authenticated model access and runtime as reusable local infrastructure for adjacent apps instead of keeping it trapped inside the primary chat UI.
- Seen in: Hermes subscription proxy for OpenAI-compatible apps with automatic upstream credential refresh, plus Hermes API server exposure for external clients and tool-capable backends.
- Why it matters: once a harness already owns provider auth, routing, policies, and observability, adjacent tools should be able to reuse that control plane without every app collecting its own keys or reimplementing model plumbing.
- One-shot build instruction:
  - Add a local OpenAI-compatible proxy and embeddable agent endpoint for `agent-browser` that can expose configured models or selected agent capabilities to approved external clients, reuse the harness's existing provider credentials and policy checks, refresh upstream auth when needed, and clearly separate "proxy a model" from "invoke the agent runtime" so external apps can integrate without duplicating secrets or execution logic.

### 18. Extensible provider auth bridges with interactive login choices
- Common pattern: some harnesses are moving provider auth and model access behind extension-defined adapters instead of hardwiring every provider into the core product.
- Seen in: Pi extension-registered providers with `/login` choice callbacks, OAuth refresh, auth-file precedence, dynamic model mutation after login, and proxy or gateway overrides that still surface like first-class providers.
- Why it matters: enterprise gateways, regional deployments, and subscription-backed providers often need custom auth and routing logic, but users still expect one consistent login flow and model-selection surface.
- One-shot build instruction:
  - Let `agent-browser` extensions register provider-auth adapters that plug into the main login flow, support browser-vs-device-code selection, token refresh, auth storage, built-in provider overrides, and post-login model shaping so custom gateways or subscription-backed providers behave like first-class built-ins.

### 19. Artifact-to-skill conversion from finished work
- Common pattern: some harnesses are starting to convert finished artifacts into reusable agent behaviors instead of treating outputs as dead ends.
- Seen in: Kimi AI `Document to skills`, where documents can be uploaded and converted into reusable skills that capture structure, style, and workflow expectations for future runs.
- Why it matters: teams already have strong examples in PRDs, reports, playbooks, and templates; turning those artifacts into executable skills is a faster path to reusable automation than writing every workflow package from scratch.
- One-shot build instruction:
  - Add an artifact-to-skill flow that ingests a strong example document or repo artifact, extracts reusable workflow rules and output structure, turns them into a first-class skill package, lets a user review the generated instructions and linked assets, and makes the resulting skill available for future task routing across local, browser, and background agent surfaces.

### 20. Explicit writable-root policies that preserve the active issue workspace
- Common pattern: least-privilege sandboxing is becoming more precise, but harnesses still need to keep the current task workspace writable when users or workflows add extra roots.
- Seen in: OpenAI Symphony runtime composition for explicit `workspaceWrite` policies, where the current issue workspace is prepended automatically so linked-worktree `.git` metadata or other extra writable roots can be added without dropping normal write access.
- Why it matters: explicit writable-root overrides are easy to get wrong; if they replace the active workspace instead of extending it, agents lose the ability to edit the task they were launched to complete.
- One-shot build instruction:
  - When a run supplies explicit writable roots, automatically retain the current issue or worktree root, show the effective writable-root set to the operator, keep non-filesystem sandbox policies unchanged, and cover the composition contract with config, runtime, and app-server tests.

### 21. Runtime-editable agent configs with draft, publish, compare, and rollback
- Common pattern: some harnesses are moving agent tuning out of code-only loops and into governed runtime editors so teams can improve behavior without waiting on a full edit, commit, deploy cycle.
- Seen in: Mastra Agent Editor with Studio-side edits for instructions, tools, MCP clients, variables, display conditions, draft or publish versioning, side-by-side comparison, rollback, and a programmatic editor API.
- Why it matters: once an agent is in production, the people closest to prompt quality, tool selection, and UX regressions are often not the people who own deploy rights or repo access.
- One-shot build instruction:
  - Add a runtime agent editor for `agent-browser` that lets authorized users draft, compare, test, publish, and roll back changes to agent instructions, tool assignments, variables, and conditional behavior, while preserving a code-defined baseline, version history, and role-aware publish permissions.

### 22. Repository-scoped memory governance with guided forgetting
- Common pattern: persistent memory is becoming a governed subsystem with admin-level enablement rules, repository-level review surfaces, and explicit deletion paths instead of a hidden always-on cache.
- Seen in: GitHub Copilot Memory with enterprise and organization policy controls, repository-level fact review and deletion, repository-level disablement, user preference curation, CLI memory controls, and guided forgetting flows when a user asks Copilot to forget something.
- Why it matters: teams will not trust long-lived agent memory at scale unless they can inspect what was stored, bound where it applies, and disable or delete it without turning off the whole harness.
- One-shot build instruction:
  - Add memory governance to `agent-browser`: support explicit enablement by scope (`workspace`, `project`, `repo`, `org`, `user`), repository-level memory review and deletion, guided forgetting flows from chat, policy-aware kill switches, and clear UI that shows when a memory was learned, why it was used, and who can remove or disable it.

### 23. Multi-harness cloud control planes with shared memory and least-privilege governance
- Common pattern: the harness layer is starting to sit above individual agent runtimes so teams can launch different harnesses under one operator console, one policy model, and one long-term knowledge layer.
- Seen in: Warp Oz multi-harness orchestration for Claude Code, Codex, and Warp Agent, with cross-harness Agent Memory, per-team billing, individual credit caps, least-privilege internal-service access, and self-hosted execution choices under the same control plane.
- Why it matters: organizations increasingly want optionality at the harness layer without losing supervision, memory, cost controls, or auditability every time they swap runtimes.
- One-shot build instruction:
  - Build a multi-harness control plane for `agent-browser` that can launch approved external harnesses under one operator surface, apply shared policies and usage ledgers across them, maintain a cross-harness memory layer with source provenance, and preserve least-privilege access controls and handoff history regardless of which runtime did the work.

### 24. Install-time skill provenance cards and security scan gates
- Common pattern: skill and plugin ecosystems are starting to expose provenance and scanner evidence before install instead of asking users to trust opaque prompt bundles.
- Seen in: OpenClaw ClawHub Skill Cards, trust-envelope verification, and preinstall scan summaries with detail pages for VirusTotal, ClawScan, and static analysis.
- Why it matters: reusable workflow packages become much easier to adopt in teams when install-time trust is inspectable, reviewable, and separated from the skill instructions themselves.
- One-shot build instruction:
  - Add install-time trust surfaces for `agent-browser` skills and plugins: generate a human-readable provenance card for each package, show source and version metadata plus scanner results before install, fail closed on blocked verification states, separate trust metadata from executable prompt content, and provide explicit override or rescan flows for authorized operators.

### 25. Hotkey appshots that attach live window context to an agent thread
- Common pattern: harnesses are beginning to capture the user’s active desktop window as structured context instead of relying on the user to manually restate what is already visible.
- Seen in: Codex Appshots on macOS, where a hotkey attaches the current app window to a thread with a screenshot and any available text so the agent can immediately work from what the user is looking at.
- Why it matters: many high-value agent interactions start from transient UI state, documents, dashboards, or error screens that are expensive to re-describe accurately in chat.
- One-shot build instruction:
  - Add an appshot capture flow to `agent-browser` that lets a user hotkey-capture the active window or selected surface into the current thread, store both a screenshot and extracted text with source metadata, preview what will be shared before submit when possible, and let the agent cite or reuse that captured context in follow-up turns without requiring the user to rewrite what was already on screen.
