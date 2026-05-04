# Model Routing And Local Router

- Harness: Gemini CLI
- Sourced: 2026-05-04

## What it is
Gemini CLI exposes model routing controls, including a local router surface, so users can steer requests across models and providers without rewriting the rest of the harness workflow.

## Evidence
- Official docs: [Model Routing](https://geminicli.com/docs/cli/model-routing/)
- First-party details:
  - Gemini CLI documents routing requests through different model targets instead of assuming one default backend
  - the docs include a local router mode, which suggests the harness expects mixed model topologies
  - routing is surfaced as product configuration, not hidden implementation detail
- Latest development checkpoint:
  - model routing remains part of the current CLI docs, signaling ongoing support for provider and model flexibility.

## Product signal
Gemini CLI is leaning into model-agnostic control rather than single-model lock-in. That supports cost, latency, and capability tuning as a normal operator task.
