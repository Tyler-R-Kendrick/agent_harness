# Multi Provider And Custom Model Routing

- Harness: Pi
- Sourced: 2026-04-30

## What it is
Pi supports a wide provider matrix, subscription-backed login flows, API-key auth, and custom provider/model definitions for local or proxy-hosted inference endpoints.

## Evidence
- Official coding-agent README: [packages/coding-agent/README.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md)
- Official model docs: [docs/models.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/models.md)
- Official releases page: [badlogic/pi-mono releases](https://github.com/badlogic/pi-mono/releases)
- First-party details:
  - the README lists subscription flows for Anthropic, OpenAI Codex, and GitHub Copilot alongside a large set of API-key providers
  - `models.json` supports custom providers and models for Ollama, vLLM, LM Studio, proxies, and other compatible endpoints
  - compatibility flags allow per-provider handling for differences like `developer` role support and reasoning controls
- Latest development checkpoint:
  - late-April 2026 releases added GPT-5.5 Codex support, DeepSeek support, Cloudflare Workers AI support, and a searchable `/login` provider selector

## Product signal
Pi is competing on model-plane flexibility as much as on agent UX, which makes it appealing to teams that want to bring their own providers, local inference stack, or routing policy.
