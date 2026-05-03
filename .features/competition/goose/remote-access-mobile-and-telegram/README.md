# Remote Access, Mobile, And Telegram

- Harness: Goose
- Sourced: 2026-05-03

## What it is
Goose includes experimental remote access modes so users can reach their running agent from a mobile app or through Telegram when away from their computer.

## Evidence
- Official docs: [Remote Access](https://goose-docs.ai/docs/experimental/remote-access/)
- Official release notes: [Goose v1.30.0](https://github.com/aaif-goose/goose/releases/tag/v1.30.0)
- First-party details:
  - Goose documents mobile access through secure tunneling to goose Desktop from the Goose AI iOS app.
  - The same remote-access docs expose a Telegram Gateway for chatting with Goose from any device.
  - `v1.30.0` documentation specifically called out a Remote Access section with Telegram Gateway documentation.
- Latest development checkpoint:
  - the current remote-access docs show Goose extending beyond local desktop presence into away-from-keyboard control and messaging ingress

## Product signal
Goose is treating agent access as ambient and portable. Messaging ingress and mobile reach matter once users expect automations and long-running sessions to keep going off-device.
