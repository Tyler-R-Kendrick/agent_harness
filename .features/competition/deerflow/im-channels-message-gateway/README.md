# IM Channels Message Gateway

- Harness: DeerFlow
- Sourced: 2026-06-04

## What it is
DeerFlow can receive tasks directly from messaging apps and continue the same harness flows through chat-native commands and thread handling.

## Evidence
- GitHub README: [DeerFlow - 2.0](https://github.com/bytedance/deer-flow/blob/main/README.md)
- DeerFlow backend notes: [backend/README.md](https://github.com/bytedance/deer-flow/blob/main/backend/README.md)
- First-party details:
  - supported channels now span Telegram, Slack, Feishu/Lark, WeChat, WeCom, and DingTalk
  - channels auto-start when configured and use long-polling, Socket Mode, or long-connection transports instead of requiring a public callback surface
  - built-in chat commands include `/new`, `/status`, `/models`, `/memory`, and `/help`
  - channel sessions can route to the default `lead_agent` or custom agents
  - Feishu can stream updates into a single in-thread card while the run is in progress, and WeChat persists bootstrap auth state under `state_dir`

## Product signal
DeerFlow pushes the harness beyond IDE and web surfaces into ambient, chat-first task intake and follow-up.
