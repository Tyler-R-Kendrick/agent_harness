# Browser Automation

- Harness: OpenClaw
- Sourced: 2026-05-20

## What it is
OpenClaw ships a managed browser lane for agent-controlled web work, while also supporting attachment to the operator's real browser profile through Chrome MCP when that tradeoff is intentional.

## Evidence
- Official docs: [Browser (openclaw-managed)](https://docs.openclaw.ai/tools/browser)
- Official release notes: [OpenClaw 2026.5.18](https://github.com/openclaw/openclaw/releases)
- First-party details:
  - OpenClaw can run a dedicated Chrome, Brave, Edge, or Chromium profile that is isolated from the user's personal browser profile
  - the browser is managed through a loopback-only local control service inside the gateway
  - the docs distinguish the isolated `openclaw` profile from the built-in `user` profile that attaches to a signed-in real browser session through Chrome MCP
  - the stable `2026.5.18` release added dialog-aware behavior: snapshots surface pending and recently handled modal dialogs, actions can return `blockedByDialog`, and the browser CLI can answer dialogs by id
- Latest development checkpoint:
  - the May 18, 2026 stable release tightened browser control around modal interruptions, which makes the browser runtime more resilient under real-world site behavior than the older marketing copy implied

## Product signal
OpenClaw is treating browser automation as a structured runtime surface with explicit profile isolation and interruption handling, not just “agent can click web pages.”
