# Multi-Platform Gateway

- Harness: Hermes Agent
- Sourced: 2026-06-06

## What it is
Hermes runs one long-lived agent runtime across CLI, browser, messaging apps, mobile, and newer adapters, and it now documents explicit thread-preserving handoff between surfaces instead of treating continuity as an informal convention.

## Evidence
- Official site: [Hermes Agent](https://hermes-agent.org/)
- Official docs: [Desktop App](https://hermes-agent.nousresearch.com/docs/user-guide/desktop)
- Official docs: [Messaging Gateway](https://hermes-agent.nousresearch.com/docs/user-guide/messaging)
- Official docs: [Sessions](https://hermes-agent.nousresearch.com/docs/user-guide/sessions/)
- Official docs: [Features Overview](https://hermes-agent.nousresearch.com/docs/user-guide/features/overview/)
- Official release: [Hermes Agent v0.16.0](https://github.com/NousResearch/hermes-agent/releases)
- Official release: [Hermes Agent v0.14.0](https://github.com/NousResearch/hermes-agent/releases)
- First-party details:
  - the messaging docs now list CLI, browser, Telegram, Discord, Slack, WhatsApp, Signal, SMS, email, Home Assistant, Mattermost, Matrix, DingTalk, Feishu or Lark, WeCom, Weixin, BlueBubbles iMessage, QQ, Yuanbao, Microsoft Teams, LINE, and more behind one gateway process
  - sessions are stored centrally with full message history and FTS-backed search, and `/handoff <platform>` can move a live CLI session into a messaging platform home channel while keeping the same session id and transcript
  - the gateway handles background cron jobs, voice delivery, and home-channel routing alongside ordinary user chat ingress
  - the desktop app can now connect to a remote Hermes gateway over OAuth or username/password, and each profile can target a different remote host while sharing live session links in one window
  - the June 5, 2026 release keeps the gateway in the core product surface rather than splitting continuity features into a separate cloud service
- Latest development checkpoint:
  - the current docs push Hermes beyond "many adapters" into explicit cross-surface session continuity, including handoff, remote desktop-to-gateway control, and shared-session behavior across authorized users in a destination thread

## Product signal
Hermes is optimizing for ambient ingress and explicit live handoff, which makes the harness feel like resident infrastructure rather than a session trapped in one UI.
