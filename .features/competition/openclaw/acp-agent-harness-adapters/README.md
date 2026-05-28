# ACP Agent Harness Adapters

- Harness: OpenClaw
- Sourced: 2026-05-20

## What it is
OpenClaw can dispatch work into external ACP-compatible agent runtimes such as Codex and Claude instead of forcing every run through its default embedded runtime.

## Evidence
- Official docs: [ACP Agents](https://docs.openclaw.ai/tools/acp-agents)
- First-party details:
  - OpenClaw can fetch a target harness adapter on demand with `npx` the first time that ACP harness is used
  - `/acp spawn codex` and `/acp spawn claude` are first-party examples, which makes external harness delegation part of the supported product surface rather than an undocumented hack
  - ACP sessions can bind to threads so follow-up messages in the same thread route back into the bound ACP session instead of starting over
  - the docs call out adapter-specific thread-spawn support for Discord and Telegram topics, with clear fallback behavior when a channel lacks thread-binding support
- Latest development checkpoint:
  - the current ACP docs emphasize thread-bound sessions, on-demand adapter bootstrap, and delivery-route persistence, which makes OpenClaw look increasingly like a gateway for multiple agent runtimes rather than a single monolithic assistant

## Product signal
OpenClaw is converging on a harness-of-harnesses model: own the routing, delivery, and policy layers centrally while letting specialized external runtimes execute the turns they are best at.
