# Local Web Dashboard And Browser-Embedded TUI

- Harness: Hermes Agent
- Sourced: 2026-06-06

## What it is
Hermes exposes a browser-based local dashboard that now spans both embedded TUI chat and a broader operator surface for sessions, analytics, cron, skills, config, and dashboard extensions.

## Evidence
- Official docs: [Web Dashboard](https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard)
- Official release: [Hermes Agent v0.16.0](https://github.com/NousResearch/hermes-agent/releases)
- First-party details:
  - `hermes dashboard` starts a local web server and opens `http://127.0.0.1:9119`
  - the dashboard exposes status, sessions, logs, usage analytics, cron management, skills and toolset toggles, config editing, and environment-variable management through documented REST endpoints
  - the Chat tab embeds the real `hermes --tui` session in-browser through a PTY plus WebSocket bridge, with resume-from-session support
  - current docs describe built-in themes plus user-defined theme and plugin-tab extension, including custom backend API routes
  - the June 5, 2026 release expands the dashboard from a local monitor into a fuller control plane with dedicated admin pages for gateway channels, MCP catalog configuration, credentials, webhooks, memory, and system actions
  - native Windows installs can use most dashboard surfaces directly, while the embedded chat pane explicitly requires WSL2 or another POSIX PTY environment
- Latest development checkpoint:
  - the current docs and `v0.16.0` release treat the dashboard as a browser-native operations surface, not a thin read-only monitor

## Product signal
Hermes is collapsing terminal-native power, browser-native supervision, and dashboard extensibility into one localhost operator console.
