# OpenClaw Design

## Look And Feel

- OpenClaw designs the assistant as an always-on personal service rather than a browser tab or developer library.
- The primary surface is messaging: WhatsApp, Telegram, Slack, Discord, iMessage, Matrix, Teams, and many other channels are framed as the user interface.
- The Gateway is explicitly described as the control plane, while the product identity is the assistant that can speak, listen, and render a live Canvas.
- The style is self-hosted and hacker-friendly: GitHub README, docs, Discord, Docker/Nix references, and a skills ecosystem.

## Design Tokens To Track

```yaml
surface: messaging-channels-plus-live-canvas
accent: self-hosted-always-on-assistant
primary_control: message-to-agent
core_objects:
  - gateway
  - channel
  - skill
  - plugin
  - device
  - live-canvas
  - local-agent-turn
information_density: high
trust_posture: self-hosted-but-local-execution-heavy
```

## Differentiators

- OpenClaw is not trying to be only an AI browser; it competes as a personal agent reachable from the communication tools users already check.
- The broad channel list makes the assistant feel ambient and always available.
- Self-hosting and local device execution are strong trust and customization signals for technical users.
- Skills let the assistant expand into browser, file, script, calendar, messaging, and workflow tasks.

## What Is Good

- Messaging as the UI removes the need to install and learn a new browser surface for many tasks.
- A live Canvas gives the assistant a visual/control surface when chat is not enough.
- Self-hosting gives power users data-sovereignty and integration control.
- The channel breadth makes the product sticky for users who want one agent across many inboxes.

## Where It Breaks Down

- Always-on local authority is a dangerous default unless permissions, sandboxing, and install provenance are extremely clear.
- Skills that can execute local code create a much sharper trust boundary than browser automation alone.
- A messaging-first interface can hide the exact browser or desktop evidence behind terse chat updates.
- Multiple names and a fast-moving ecosystem can confuse users and create impersonation risk.

## Screenshot References

- GitHub README and product imagery: `https://github.com/openclaw/openclaw`
- Documentation and getting-started paths: `https://docs.openclaw.ai/`
