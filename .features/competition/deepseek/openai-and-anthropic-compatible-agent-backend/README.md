# OpenAI And Anthropic Compatible Agent Backend

- Harness: DeepSeek
- Sourced: 2026-05-14

## What it is
DeepSeek is deliberately positioning itself as a drop-in backend for existing coding and agent harnesses by supporting both OpenAI-style and Anthropic-style API shapes.

## Evidence
- Official docs: [Your First API Call](https://api-docs.deepseek.com/) and [Anthropic API](https://api-docs.deepseek.com/guides/anthropic_api)
- First-party details:
  - the quick-start docs say the API is compatible with both OpenAI and Anthropic formats
  - DeepSeek exposes separate `base_url` values for OpenAI-compatible and Anthropic-compatible clients
  - the Anthropic docs explicitly show DeepSeek being used from the Anthropic SDK with `https://api.deepseek.com/anthropic`
  - the quick start says users of `Claude Code`, `GitHub Copilot`, and `OpenCode` can use DeepSeek as the backend model directly
- Latest development checkpoint:
  - the April 24, 2026 V4 change log confirms the current V4 models are available through both ChatCompletions and Anthropic interfaces

## Product signal
DeepSeek is competing not only as a model vendor but as a portability layer for other agent products, lowering the friction of swapping model backends without rebuilding the harness.
