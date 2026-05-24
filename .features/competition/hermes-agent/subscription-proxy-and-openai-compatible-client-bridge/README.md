# Subscription Proxy And OpenAI-Compatible Client Bridge

- Harness: Hermes Agent
- Sourced: 2026-05-24

## What it is
Hermes now exposes a local subscription proxy that lets external OpenAI-compatible apps reuse the harness's managed model subscription and refreshed credentials instead of requiring separate static API keys per downstream tool.

## Evidence
- Official docs: [Subscription Proxy](https://hermes-agent.nousresearch.com/docs/user-guide/features/subscription-proxy)
- Official docs: [Features Overview](https://hermes-agent.nousresearch.com/docs/user-guide/features/overview/)
- Official release: [Hermes Agent v0.14.0](https://github.com/NousResearch/hermes-agent/releases)
- First-party details:
  - the subscription proxy is a local HTTP server for OpenAI-compatible clients such as Open WebUI, Karakeep, and similar apps
  - clients point to `http://127.0.0.1:8645/v1` with any non-empty API key while Hermes attaches and refreshes the real upstream credential itself
  - Hermes positions this separately from the agent API server: the proxy reuses a managed provider subscription, while the API server exposes Hermes itself as the backend
  - the feature overview now lists an API Server as part of the main harness surface, which reinforces that Hermes is treating external embedding as a first-class capability
- Latest development checkpoint:
  - the latest public docs and `v0.14.0` release line show Hermes moving beyond "agent with tools" into "agent platform whose authenticated model access can be safely re-exported to other apps"

## Product signal
Hermes is turning harness-managed credentials and model routing into reusable infrastructure for adjacent tools, not just a private runtime detail inside the agent.
