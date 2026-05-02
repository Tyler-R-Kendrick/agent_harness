# OTEL Observability And Browser Session Replay

- Harness: OpenHands
- Sourced: 2026-05-02

## What it is
OpenHands ships built-in OpenTelemetry tracing in its SDK and explicitly traces agent steps, tool calls, conversation lifecycle, and browser automation sessions. When paired with Laminar and browser-use, it can capture browser session replay.

## Evidence
- Official docs: [Observability & Tracing](https://docs.openhands.dev/sdk/guides/observability)
- First-party details:
  - OpenHands says the SDK has built-in OTEL tracing support for OTLP-compatible backends
  - traced items include agent execution steps, tool calls, LiteLLM API calls, browser automation sessions, and conversation lifecycle events
  - the docs also call out browser session replay when Laminar is used with browser-use tools
- Latest development checkpoint:
  - the current observability docs describe this as real-time monitoring and debugging infrastructure rather than an afterthought

## Product signal
OpenHands is making runtime evidence portable across observability stacks. The browser-session replay hook is especially relevant because it closes the gap between agent logs and what the UI automation actually did.
