# Centralized Agent Management And Mobile Operator Console

- Harness: Warp
- Sourced: 2026-05-19

## What it is
Warp now treats agent operations as a first-class control surface, with one management view for local conversations and cloud runs plus a mobile-friendly Oz web app for remote supervision.

## Evidence
- Official docs: [Managing Cloud Agents](https://docs.warp.dev/agent-platform/cloud-agents/managing-cloud-agents/)
- Official docs: [Oz web app](https://docs.warp.dev/agent-platform/cloud-agents/oz-web-app/)
- First-party details:
  - the management view covers both interactive desktop conversations and cloud agent runs in one scannable list
  - each row exposes source, status, duration, creator, and credit usage so operators can understand what happened without opening the full transcript first
  - filters let teams isolate failed work, scheduled runs, Slack or Linear launches, or a specific teammate's activity
  - the same control plane is available in the Warp app and at `oz.warp.dev`, which Warp documents as working on mobile devices
- Latest development checkpoint:
  - Warp's May 12, 2026 docs position management as a default navigation surface for observability and intervention rather than an admin afterthought

## Product signal
Warp is converging on an operator-console model where long-running agents are supervised from a shared inbox instead of rediscovered through raw logs or terminal history.
