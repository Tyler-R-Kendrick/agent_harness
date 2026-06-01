# OpenClaw

- Harness: OpenClaw
- Refreshed: 2026-06-01

## Current feature map
- `acp-agent-harness-adapters`: ACP-backed access to external agent runtimes like Codex and Claude with thread-bound session routing.
- `background-task-ledger-and-task-flow`: detached work is tracked as durable task records instead of disappearing into logs.
- `browser-automation`: OpenClaw-managed browser profiles, real-user profile attachment, and dialog-aware browser actions.
- `canvas-and-agent-controlled-ui`: agent-controlled Canvas surfaces with snapshots, JS eval, and A2UI rendering.
- `chat-app-everywhere-interface`: one gateway fronts many messaging channels plus web chat and dashboard surfaces.
- `command-queue-and-progress-drafts`: in-flight steering, follow-up queue modes, and visible work-in-progress drafts.
- `control-ui-and-dashboard`: browser dashboard for chat, config, sessions, nodes, and admin approvals.
- `full-system-access-and-self-hosting`: local-first self-hosted gateway with remote-over-SSH operation.
- `multi-agent-workspaces-and-routing`: isolated agents with separate workspaces, auth state, session stores, and per-agent tool policies.
- `permission-modes-auto-review-and-chat-native-approvals`: normalized host-exec permission modes that combine allowlists, native auto-review, Codex Guardian integration, and human approval fallback.
- `persistent-memory`: injected workspace bootstrap files plus durable session stores, pruning, compaction, and cross-session tools.
- `remote-gateway-and-mobile-nodes`: remote gateway access plus paired macOS, iOS, and Android nodes over the same control plane.
- `skill-cards-and-preinstall-security-scan-provenance`: generated Skill Cards plus ClawHub trust envelopes and scan summaries before install.
- `skills-and-plugins`: layered skill precedence, plugin-shipped skills, Skill Workshop, and typed plugin SDK tooling.
- `workboard-kanban-and-agent-card-dispatch`: a local operator board that can dispatch Codex or Claude work from linked cards, tasks, and sessions.

## First-party sources used in this refresh
- [OpenClaw overview](https://docs.openclaw.ai/)
- [GitHub repository README](https://github.com/openclaw/openclaw)
- [OpenClaw releases](https://github.com/openclaw/openclaw/releases)
- [Agent Runtime](https://docs.openclaw.ai/concepts/agent)
- [Multi-Agent Routing](https://docs.openclaw.ai/concepts/multi-agent)
- [Session Management](https://docs.openclaw.ai/concepts/session)
- [Skills](https://docs.openclaw.ai/tools/skills)
- [ClawHub](https://docs.openclaw.ai/clawhub)
- [Control UI](https://docs.openclaw.ai/control-ui)
- [Dashboard](https://docs.openclaw.ai/dashboard)
- [Browser tool](https://docs.openclaw.ai/tools/browser)
- [ACP Agents](https://docs.openclaw.ai/tools/acp-agents)
- [Command Queue](https://docs.openclaw.ai/concepts/queue)
- [Background tasks](https://docs.openclaw.ai/automation/tasks)
- [Workboard plugin](https://docs.openclaw.ai/plugins/workboard)
- [Permission modes](https://docs.openclaw.ai/tools/permission-modes)
- [Exec approvals](https://docs.openclaw.ai/tools/exec-approvals)
- [Remote access](https://docs.openclaw.ai/gateway/remote)
- [Canvas](https://docs.openclaw.ai/platforms/mac/canvas)
- [OpenClaw product notes](https://openclaw.ai/)

## Screenshots and demos
- Official visuals are embedded directly in the docs for Control UI, Dashboard, Canvas, browser tooling, Workboard, and node/mobile workflows.

## Product signal
OpenClaw has moved beyond “chat with an agent from Messenger.” The current product direction is a self-hosted agent gateway with explicit runtime routing, queue control, operator workboards, policy-first host execution, and audited skill distribution across chat apps, browsers, desktops, and mobile nodes.
