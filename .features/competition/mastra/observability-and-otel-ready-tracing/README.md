# Observability And OTEL-Ready Tracing

- Harness: Mastra
- Sourced: 2026-05-01

## What it is
Mastra ships a dedicated observability surface for agents and workflows with token, latency, prompt, completion, tool-call, memory, and trace visibility, plus export paths into external telemetry systems.

## Evidence
- Official product page: [AI Agent Observability](https://mastra.ai/ai-agent-observability)
- Official changelog: [Mastra Changelog 2026-03-13](https://mastra.ai/blog/changelog-2026-03-13)
- First-party details:
  - Mastra says every LLM call logs token usage, latency, prompts, and completions.
  - The same page says every agent run captures decision paths, tool calls, and memory operations.
  - The observability product is described as integrating with OpenTelemetry-compatible platforms.
  - the March 13, 2026 changelog adds a full observability storage domain for scores, logs, feedback, metrics, and discovery.
- Latest development checkpoint:
  - by mid-March 2026 Mastra was still expanding the observability storage layer and type-safe telemetry plumbing, which suggests observability remains a major product investment area

## Product signal
Mastra is treating agent observability as a first-class product, not a debug sidebar. That points toward harnesses where traces, metrics, and scoring are part of the operator contract from day one.
