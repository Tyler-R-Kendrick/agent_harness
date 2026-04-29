# Local Trace Observability

- Harness: T3 Code
- Sourced: 2026-04-29

## What it is
T3 Code ships an observability model with local NDJSON traces by default and optional OTLP export for deeper inspection.

## Evidence
- Observability doc: [docs/observability.md](https://raw.githubusercontent.com/pingdotgg/t3code/main/docs/observability.md)
- First-party details:
  - completed spans are written to a local `server.trace.ndjson` file
  - logs are human-facing on stdout, while traces are the persisted source of truth
  - OTLP trace and metric export can be enabled for tools like Grafana LGTM
  - the docs include concrete commands for tailing failed spans, slow spans, orchestration commands, and git activity

## Product signal
T3 Code treats production-style tracing as part of agent operations, which is a meaningful differentiator for debugging long-running or remotely accessed harnesses.
