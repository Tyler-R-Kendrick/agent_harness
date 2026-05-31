# Bring Your Own Inference And OpenAI-Compatible Endpoints

- Harness: Warp
- Sourced: 2026-05-31

## What it is
Warp now lets users bring their own provider keys and connect custom OpenAI-compatible inference endpoints so the Warp agent surface can sit on top of internal gateways, routers, or self-hosted model stacks.

## Evidence
- Official post: [Bring your own inference to Warp](https://www.warp.dev/blog/bring-your-own-inference-to-warp)
- First-party details:
  - BYOK is now available on Warp's free plan for supported OpenAI, Anthropic, and Google providers.
  - Warp now supports custom inference endpoints compatible with the OpenAI Chat Completions API.
  - Warp explicitly names OpenRouter, LiteLLM, z.ai, internal gateways, and self-hosted inference as valid endpoint patterns.
  - Warp says its built-in agent surface still retains access to terminal state, indexed codebase, rules, notebooks, workflows, env vars, MCP servers, code review, agent management, and Oz.
  - Warp says larger teams can use the same model-control path under Business or Enterprise plans with platform-credit accounting around managed execution time.
  - the roadmap section says Warp plans a lightweight Rust client harness for local models and ACP support so other agent harnesses can plug into Warp's terminal UI without requiring login.
- Latest development checkpoint:
  - On May 20, 2026, Warp moved model choice and endpoint routing closer to a control-plane concern instead of bundling it rigidly with Warp-managed inference.

## Screenshots and demos
- Official visual: the launch post includes a BYO inference header image with Claude, Gemini CLI, and Codex branding.
- Official video demos are embedded in the post for BYOK setup and custom endpoint configuration.

## Product signal
Warp is betting that the durable product is the integrated harness experience, not exclusive ownership of the model backend, which is a meaningful shift toward gateway-friendly and enterprise-routable deployment.
