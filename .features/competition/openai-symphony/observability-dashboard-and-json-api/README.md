# Observability Dashboard And JSON API

- Harness: OpenAI Symphony
- Sourced: 2026-04-30

## What it is
Symphony exposes operator-facing runtime visibility through structured logs, an optional status surface, and an optional web dashboard with JSON debugging endpoints.

## Evidence
- Official spec: [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Elixir reference docs: [elixir/README.md](https://github.com/openai/symphony/blob/main/elixir/README.md)
- First-party details:
  - the spec lists structured logging as a core component and requires operator-visible observability at minimum through logs
  - the spec defines an optional status surface plus baseline JSON endpoints such as `/api/v1/state`, `/api/v1/<issue_identifier>`, and `/api/v1/refresh`
  - the Elixir reference says `--port` enables a Phoenix observability service
  - the Elixir README says the current UI includes a LiveView dashboard at `/` and a JSON API for operational debugging under `/api/v1/*`
- Media provided:
  - Elixir UI screenshot: ![Symphony Elixir screenshot](https://raw.githubusercontent.com/openai/symphony/main/.github/media/elixir-screenshot.png)
- Latest development checkpoint:
  - the public prototype already ships a minimal Phoenix dashboard and JSON API, which is unusually concrete for an early orchestration harness

## Product signal
Symphony treats runtime introspection as required operating surface area, not a future admin console, which is a strong signal for long-running multi-agent products.
