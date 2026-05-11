# WebBridge Local Browser Control For Agents

- Harness: Kimi AI
- Sourced: 2026-05-11

## What it is
Kimi WebBridge is a local browser-control bridge that lets supported agents drive an existing Chrome or Edge session through a browser extension plus local service.

## Evidence
- Official feature page: [Kimi WebBridge](https://www.kimi.com/features/webbridge)
- First-party details:
  - Kimi says WebBridge clicks, fills, navigates, and extracts through a browser extension for AI agents
  - the feature ships with a shell install command that connects the local browser bridge to an agent automatically
  - the supported-agent list explicitly includes Kimi Code, Claude Code, Cursor, Codex, and Hermes
  - Kimi says the local service uses Chrome DevTools Protocol to navigate, click, screenshot, and read pages in the user's existing browser
  - page content and login sessions stay local to the user's device
- Latest development checkpoint:
  - the current WebBridge surface shows Kimi treating browser control as an attachable capability layer that can enhance third-party agent harnesses, not just Kimi's own first-party coding tools

## Product signal
Kimi is betting that browser control can become infrastructure for the agent ecosystem, with local privacy and existing-session reuse as the main adoption levers.
