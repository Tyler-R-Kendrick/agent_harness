# Observability Dashboard And JSON API

- Harness: OpenAI Symphony
- Sourced: 2026-05-17

## What it is
Symphony exposes operator-facing runtime visibility through structured logs, a JSON debugging API, and a live dashboard that now doubles as an operations console rather than a thin status page.

## Evidence
- Official spec: [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Elixir reference docs: [elixir/README.md](https://github.com/openai/symphony/blob/main/elixir/README.md)
- Open PR: [#68 Add dashboard agent details](https://github.com/openai/symphony/pull/68)
- First-party details:
  - the spec lists structured logging as a core component and requires operator-visible observability at minimum through logs
  - the spec defines an optional status surface plus baseline JSON endpoints such as `/api/v1/state`, `/api/v1/<issue_identifier>`, and `/api/v1/refresh`
  - the Elixir reference says `--port` enables a Phoenix observability service
  - the Elixir README says the current UI includes a LiveView dashboard at `/` and a JSON API for operational debugging under `/api/v1/*`
  - PR #68 says the dashboard now keeps a bounded recent Codex update history for active sessions, adds execution stage and checklist payloads to the presenter layer, and makes running sessions selectable so operators can inspect workspace metadata and recent events inline
- Media provided:
  - Elixir UI screenshot: ![Symphony Elixir screenshot](https://raw.githubusercontent.com/openai/symphony/main/.github/media/elixir-screenshot.png)
- Latest development checkpoint:
  - on May 7, 2026, OpenAI opened PR #68 to deepen the dashboard into a session-detail console with stage, checklist, and recent activity instead of forcing operators into raw JSON views

## Product signal
Symphony treats runtime introspection as required operating surface area, and the latest dashboard work suggests operators are expected to supervise live autonomous runs from a control console, not just scrape logs after failure.
