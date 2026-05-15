# Local Web Dashboard And Browser-Embedded TUI

- Harness: Hermes Agent
- Sourced: 2026-05-15

## What it is
Hermes exposes a browser-based local dashboard that manages settings, sessions, gateway state, and even the full TUI chat experience without leaving localhost.

## Evidence
- Official docs: [Web Dashboard](https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard)
- Official release: [Hermes Agent v0.9.0](https://github.com/NousResearch/hermes-agent/releases)
- First-party details:
  - `hermes dashboard` starts a local web server and opens `http://127.0.0.1:9119`
  - the dashboard manages settings, API keys, gateway status, recent sessions, and approvals
  - the Chat tab can embed the real `hermes --tui` session in-browser through a PTY plus WebSocket bridge
  - the release notes position the dashboard as the easiest way to manage Hermes without editing config files or living in the terminal
- Latest development checkpoint:
  - current docs still treat the dashboard as a primary management surface rather than a thin monitoring page

## Product signal
Hermes is collapsing terminal-native power and browser-native manageability into one local control plane, which broadens the harness beyond expert CLI operators.
