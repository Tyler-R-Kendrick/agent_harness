# Observational Memory With Stable Context

- Harness: Mastra
- Sourced: 2026-05-01

## What it is
Mastra's Observational Memory replaces long raw chat history with a structured observation log maintained by background agents, preserving long-term context while keeping the prompt stable and cache-friendly.

## Evidence
- Official research: [Observational Memory: 95% on LongMemEval](https://mastra.ai/research/observational-memory)
- Official announcement: [Announcing Observational Memory](https://mastra.ai/blog/observational-memory)
- First-party details:
  - Mastra says two background agents, an Observer and a Reflector, maintain a dense observation log that replaces raw message history as it grows.
  - The research page says the approach keeps the context window predictable, reproducible, and prompt-cacheable rather than dynamically injecting retrieved memory every turn.
  - Mastra reports `94.87%` on LongMemEval with `gpt-5-mini`, calling it the highest recorded score on that benchmark.
- Latest development checkpoint:
  - the February 2026 research and announcement materials position Observational Memory as a flagship differentiator and as an open-source memory architecture, not just a hosted-only feature

## Product signal
Mastra is betting on memory systems that behave like always-on runtime infrastructure instead of ad hoc retrieval. That points toward harnesses where long-horizon recall, latency control, and prompt-cache economics are core product concerns.
