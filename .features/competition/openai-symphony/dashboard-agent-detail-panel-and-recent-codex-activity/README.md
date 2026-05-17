# Dashboard Agent Detail Panel And Recent Codex Activity

- Harness: OpenAI Symphony
- Sourced: 2026-05-17

## What it is
Symphony is adding a richer dashboard detail view so operators can click a running session and inspect its current stage, checklist, workspace metadata, and recent Codex activity without leaving the control panel.

## Evidence
- Open PR: [#68 Add dashboard agent details](https://github.com/openai/symphony/pull/68)
- Elixir reference docs: [elixir/README.md](https://github.com/openai/symphony/blob/main/elixir/README.md)
- First-party details:
  - PR #68 says the existing dashboard did not expose enough live detail to understand what an agent was doing
  - the proposed change keeps a bounded recent Codex update history for active sessions
  - presenter payloads gain execution stage and checklist data
  - running-session rows become selectable and render an agent detail panel with current stage, workspace or session metadata, checklist status, and recent events
  - the PR also adds responsive styling, tests, and README documentation for the new panel
- Media provided:
  - Elixir UI screenshot: ![Symphony Elixir screenshot](https://raw.githubusercontent.com/openai/symphony/main/.github/media/elixir-screenshot.png)
- Latest development checkpoint:
  - on May 7, 2026, the public repo moved from a flat running-sessions list toward a compact but inspectable operator console

## Product signal
Symphony is converging on an operator UX where supervising autonomous work means reading live stage and checklist state, not opening raw logs or waiting for the final proof packet.
