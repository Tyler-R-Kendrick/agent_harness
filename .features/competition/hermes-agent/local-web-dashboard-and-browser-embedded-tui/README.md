# Local Web Dashboard And Browser-Embedded TUI

- Harness: Hermes Agent
- Sourced: 2026-05-24

## What it is
Hermes exposes a browser-based local dashboard that manages settings, sessions, analytics, cron, skills, and even the real TUI chat experience, and it now documents plugin tabs and theme extension as part of the core management surface.

## Evidence
- Official docs: [Web Dashboard](https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard)
- Official release: [Hermes Agent v0.14.0](https://github.com/NousResearch/hermes-agent/releases)
- First-party details:
  - `hermes dashboard` starts a local web server and opens `http://127.0.0.1:9119`
  - the dashboard now exposes status, sessions, logs, usage analytics, cron management, skills and toolset toggles, config editing, and environment-variable management through documented REST endpoints
  - the Chat tab embeds the real `hermes --tui` session in-browser through a PTY plus WebSocket bridge, with resume-from-session support
  - current docs describe built-in themes plus user-defined theme and plugin-tab extension, including custom backend API routes
  - native Windows installs can use most dashboard surfaces directly, while the embedded chat pane explicitly requires WSL2 or another POSIX PTY environment
- Latest development checkpoint:
  - the current docs treat the dashboard as a local control plane and extension host, not a thin read-only monitor

## Product signal
Hermes is collapsing terminal-native power, browser-native supervision, and dashboard extensibility into one localhost operator console.
