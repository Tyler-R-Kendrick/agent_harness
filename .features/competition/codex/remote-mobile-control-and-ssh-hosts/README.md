# Remote Mobile Control And SSH Hosts

- Harness: Codex
- Sourced: 2026-05-16

## What it is
Codex supports remote connections so users can steer a Codex host from the ChatGPT mobile app or point Codex at projects living on SSH hosts.

## Evidence
- Official docs: [Remote connections](https://developers.openai.com/codex/remote-connections)
- First-party details:
  - remote access lets users start or continue threads, approve actions, review diffs, see screenshots, and get notified when work completes
  - the remote client inherits the host machine’s projects, threads, credentials, permissions, plugins, browser setup, and local tools
  - mobile setup starts from the desktop app, which shows a QR code for ChatGPT mobile to pair with the host
  - connected-device settings can keep the host awake and enable Computer Use or the Chrome extension remotely
  - the same doc positions SSH-host projects as another remote-connection target
- Latest development checkpoint:
  - Codex now frames remote operation as host control, not just viewing logs from afar, with approval and supervision surfaces exposed on mobile

## Product signal
Codex is treating the developer workstation as a remotely steerable agent host whose full tool stack can be supervised from another device.
