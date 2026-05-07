# Gateway Model Routing And Organization Controls

- Harness: Kilo Code
- Sourced: 2026-05-07

## What it is
Kilo pairs its coding surfaces with an OpenAI-compatible gateway that centralizes access to hundreds of models, usage tracking, BYOK, and organization-level model controls.

## Evidence
- Official docs: [AI Gateway](https://kilo.ai/docs/gateway)
- Official docs: [Model Access Controls](https://kilo.ai/docs/collaborate/enterprise/model-access-controls)
- Official product page: [Kilo home page](https://kilo.ai/)
- First-party details:
  - the gateway docs say one API key can access models from Anthropic, OpenAI, Google, xAI, Mistral, MiniMax, and others through a single endpoint
  - Kilo advertises 500-plus models and provider-rate pricing across VS Code, JetBrains, CLI, and cloud surfaces
  - gateway features include streaming, BYOK, usage tracking, tool calling, and fill-in-the-middle completions
  - organization controls include model allow or block behavior, provider restrictions, per-user daily spending limits, and balance management
  - enterprise model controls let owners block entire providers or specific models and filter providers by prompt retention, training behavior, and region
- Latest development checkpoint:
  - the current product positions the gateway as shared infrastructure for the whole Kilo surface area, which means model routing and cost control are now part of harness design rather than a user-side API choice

## Product signal
Kilo is using a unified gateway to turn model access, pricing visibility, and policy enforcement into first-class harness primitives.