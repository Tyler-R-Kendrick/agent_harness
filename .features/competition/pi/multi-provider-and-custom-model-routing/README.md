# Multi Provider And Custom Model Routing

- Harness: Pi
- Sourced: 2026-05-26

## What it is
Pi supports a wide built-in provider matrix, subscription-backed login flows, API-key auth, and custom provider/model definitions for local or proxy-hosted inference endpoints.

## Evidence
- Official coding-agent README: [packages/coding-agent/README.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md)
- Official providers docs: [docs/providers.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md)
- Official model docs: [docs/models.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md)
- Official custom provider docs: [docs/custom-provider.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/custom-provider.md)
- Official releases page: [earendil-works/pi releases](https://github.com/earendil-works/pi/releases)
- First-party details:
  - the README and `providers.md` list subscription login flows for ChatGPT Plus or Pro (Codex), Claude Pro or Max, and GitHub Copilot, alongside a large API-key matrix spanning OpenAI, Azure OpenAI, DeepSeek, Gemini, Bedrock, Cloudflare AI Gateway, Workers AI, Vercel AI Gateway, Kimi For Coding, Xiaomi MiMo, and more
  - `models.md` documents `~/.pi/agent/models.json` for Ollama, vLLM, LM Studio, proxies, and other compatible endpoints, including per-provider and per-model compatibility overrides
  - Pi now accepts JSONC-style comments and trailing commas in `models.json`, which makes large custom model registries easier to maintain
  - `custom-provider.md` shows that extensions can override built-in providers, add dynamic model discovery from remote `/models` endpoints, and route existing providers through custom gateways without losing the main model-picker experience
- Latest development checkpoint:
  - release `v0.73.1` on 2026-05-07 added interactive OAuth login selection and JSONC `models.json` parsing, extending Pi's provider plane without reducing the existing custom-model surface

## Product signal
Pi is competing on model-plane flexibility as much as on agent UX, which makes it appealing to teams that want to bring their own providers, local inference stack, or routing policy while still keeping one coherent harness UI.
