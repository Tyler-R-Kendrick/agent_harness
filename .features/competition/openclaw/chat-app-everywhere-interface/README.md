# Chat-App-Everywhere Interface

- Harness: OpenClaw
- Sourced: 2026-05-20

## What it is
OpenClaw uses chat surfaces as the main agent ingress and treats the browser dashboard, WebChat, and mobile nodes as peers to those messaging channels rather than separate products.

## Evidence
- Official docs: [OpenClaw overview](https://docs.openclaw.ai/)
- GitHub repo: [openclaw/openclaw](https://github.com/openclaw/openclaw)
- First-party details:
  - the overview positions one gateway as serving built-in or external channel plugins such as Discord, Google Chat, iMessage, Matrix, Microsoft Teams, Signal, Slack, Telegram, WhatsApp, Zalo, and more
  - the repo README describes OpenClaw as a personal AI assistant that answers on channels users already use
  - browser dashboard, WebChat, and mobile nodes sit alongside those channels on the same gateway rather than forking into a separate backend
  - the stable docs still frame “send a message, get an agent response from your pocket” as the core product contract
- Latest development checkpoint:
  - the current overview and repo README continue to position OpenClaw as a multi-surface messaging gateway first, but now with a much more explicit operator and runtime layer around that chat ingress

## Product signal
OpenClaw is still optimizing for ambient invocation from wherever the user already communicates, but the surrounding system has matured into a proper control plane rather than a pure chat bot.
