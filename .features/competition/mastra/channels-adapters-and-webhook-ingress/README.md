# Channels Adapters And Webhook Ingress

- Harness: Mastra
- Sourced: 2026-05-29

## What it is
Mastra can now expose the same agent across Slack, Discord, Telegram, and similar chat surfaces through pluggable channel adapters and per-adapter webhook endpoints while keeping Studio as the shared supervision surface.

## Evidence
- Official announcement: [Introducing Channels for Mastra Agents](https://mastra.ai/blog/introducing-channels)
- Feature index: [Mastra features archive](https://mastra.ai/blog/category/features)
- First-party details:
  - Mastra says one agent can respond to mentions and messages across Slack, Discord, Telegram, and more by attaching channel adapters instead of building each integration manually
  - the launch post says Mastra supports official adapters from Vercel's Chat SDK, making channels a framework-backed ingress layer rather than a one-off Slack example
  - the example configuration shows adapter wiring inside the agent definition and a generated webhook path like `/api/agents/<agent>/channels/slack/webhook`
  - the post says channel use does not replace Studio, so teams can still test, iterate, and observe the same agent from the main harness surface
- Latest development checkpoint:
  - channels shipped on April 28, 2026 as a new multi-surface entry point for existing agents

## Product signal
Mastra is turning external chat surfaces into a standardized ingress contract. The important signal is not just Slack support, but the idea that one supervised agent runtime should be able to accept work from many conversation surfaces without duplicating logic.
