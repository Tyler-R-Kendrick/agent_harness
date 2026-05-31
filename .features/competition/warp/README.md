# Warp

- Harness: Warp
- Refreshed: 2026-05-31

## Current feature map
- `agent-mode-conversations-and-context`: dedicated agent conversations alongside the terminal, with mode switching and reusable context.
- `bring-your-own-inference-and-openai-compatible-endpoints`: BYOK on the free plan plus OpenAI-compatible custom endpoints for routers, gateways, and self-hosted inference.
- `multi-harness-cloud-control-plane-and-cross-harness-memory`: Oz now orchestrates Claude Code, Codex, and Warp Agent under one cloud control plane with shared governance and research-preview Agent Memory.
- `open-source-issue-to-pr-contribution-loop`: Warp now runs its own public issue-to-PR workflow in the open, with agent-triaged GitHub issues as the system of record.
- `full-terminal-use-in-live-interactive-programs`: agents can attach to running PTY apps and steer interactive shells, debuggers, editors, and long-lived processes.
- `profiles-permissions-and-run-until-completion`: reusable policy profiles, MCP and command controls, and a denylist-bypassing auto-approve mode.
- `mcp-server-management`: first-class MCP configuration for local and cloud agents, including synced server configs and explicit secret handling.
- `warp-drive-workflows-and-notebooks`: reusable commands, notebooks, and shared operational assets inside Warp Drive.
- `skills-as-schedulable-cloud-agents`: repo-discovered skills can be launched from the web app, CLI, API, and schedules.
- `cloud-agent-environments-and-integrations`: hosted environments plus Slack, Linear, GitHub Actions, API, and CLI triggers.
- `scheduled-cloud-agents`: cron-triggered cloud runs for recurring maintenance and reporting tasks.
- `github-actions-agent-automation`: CI-native agent runs that can comment, suggest inline fixes, and open branches or PRs.
- `agent-session-sharing-and-live-remote-steering`: shareable live sessions for collaborative viewing, follow-up prompts, and remote steering.
- `centralized-agent-management-and-mobile-operator-console`: a scannable management view for interactive and cloud runs, available in-app and on mobile web.

## First-party sources used in this refresh
- [Warp agents overview](https://docs.warp.dev/agents)
- [Universal Input](https://docs.warp.dev/terminal)
- [Agent modality](https://docs.warp.dev/agent-platform/local-agents/interacting-with-agents/agent-modality)
- [Full terminal use](https://docs.warp.dev/agents/full-terminal-use)
- [Profiles & permissions](https://docs.warp.dev/agent-platform/capabilities/agent-profiles-permissions/)
- [Cloud agents overview](https://docs.warp.dev/agent-platform/cloud-agents/overview/)
- [Managing cloud agents](https://docs.warp.dev/agent-platform/cloud-agents/managing-cloud-agents/)
- [Cloud agent session sharing](https://docs.warp.dev/agent-platform/cloud-agents/viewing-cloud-agent-runs)
- [Session sharing](https://docs.warp.dev/knowledge-and-collaboration/session-sharing/)
- [Warp Drive workflows](https://docs.warp.dev/knowledge-and-collaboration/warp-drive/workflows/)
- [Skills as agents](https://docs.warp.dev/agent-platform/cloud-agents/skills-as-agents)
- [GitHub Actions integration](https://docs.warp.dev/agent-platform/cloud-agents/integrations/github-actions)
- [MCP servers reference](https://docs.warp.dev/reference/cli/mcp-servers)
- [A single pane of glass for managing all of your cloud agents](https://www.warp.dev/blog/multi-harness-cloud-agent-orchestration)
- [Bring your own inference to Warp](https://www.warp.dev/blog/bring-your-own-inference-to-warp)
- [Warp Open-Sources Its Agentic Development Environment](https://www.warp.dev/newsroom/2026/4/28/warp-open-sources-its-agentic-development-environment)

## Screenshots and demos
- Official visuals and demos are embedded directly in Warp's docs and blog posts for the multi-harness Oz control plane, BYOK and custom endpoint setup, management view, cloud session sharing, GitHub Actions automation, workflow editing, and run-until-completion controls.

## Product signal
Warp is no longer just an AI terminal. The current product direction is a terminal-native harness that can sit above multiple agent runtimes, govern them from one cloud control plane, and let teams choose the model and harness stack behind the interface instead of locking them into one execution path.
