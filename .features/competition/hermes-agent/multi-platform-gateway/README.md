# Multi-Platform Gateway

- Harness: Hermes Agent
- Sourced: 2026-05-15

## What it is
Hermes runs one agent identity across CLI, messaging apps, mobile, and newer platform adapters so the same long-lived runtime can accept work from wherever the user already communicates.

## Evidence
- Official site: [Hermes Agent](https://hermes-agent.org/)
- Official docs: [Features Overview](https://hermes-agent.nousresearch.com/docs/user-guide/features/overview/)
- Official release: [Hermes Agent v0.9.0](https://github.com/NousResearch/hermes-agent/releases)
- Official release: [Hermes Agent v0.12.0](https://github.com/NousResearch/hermes-agent/releases)
- First-party details:
  - the product site calls out Telegram, Discord, Slack, WhatsApp, Signal, and CLI through one gateway process
  - the docs position the gateway as a long-running router with unified session handling and background cron ticking
  - the v0.9.0 release added iMessage via BlueBubbles, WeChat and WeCom coverage, and native Termux or Android support
  - the v0.12.0 release says Hermes reached an 18th messaging platform plus a 19th through a Teams plugin
- Latest development checkpoint:
  - current first-party materials still frame Hermes as an everywhere agent that lives on user infrastructure and reaches them through many chat surfaces instead of a single local app

## Product signal
Hermes is optimizing for ambient ingress and continuity, which makes the agent feel like infrastructure that follows the user rather than a tool that must be reopened in one surface.
