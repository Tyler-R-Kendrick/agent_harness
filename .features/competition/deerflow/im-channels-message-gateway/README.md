# IM Channels Message Gateway

- Harness: DeerFlow
- Sourced: 2026-04-26

## What it is
DeerFlow can receive tasks directly from messaging apps and continue the same harness flows through chat-native commands and thread handling.

## Evidence
- GitHub README: [DeerFlow - 2.0](https://github.com/bytedance/deer-flow/blob/main/README.md)
- First-party details:
  - supported channels include Telegram, Slack, Feishu/Lark, WeChat, and WeCom
  - channels auto-start when configured and do not require a public IP
  - built-in chat commands include `/new`, `/status`, `/models`, `/memory`, and `/help`
  - channel sessions can route to the default `lead_agent` or custom agents

## Product signal
DeerFlow pushes the harness beyond IDE and web surfaces into ambient, chat-first task intake and follow-up.
