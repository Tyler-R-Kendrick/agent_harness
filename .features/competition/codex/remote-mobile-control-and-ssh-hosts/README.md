# Remote Mobile Control And SSH Hosts

- Harness: Codex
- Sourced: 2026-06-02

## What it is
Codex supports remote connections so users can steer a Codex host from the ChatGPT mobile app or point Codex at projects living on SSH hosts.

## Evidence
- Official docs: [Remote connections](https://developers.openai.com/codex/remote-connections)
- Official product post: [Work with Codex from anywhere](https://openai.com/index/work-with-codex-from-anywhere/)
- First-party details:
  - remote access lets users start or continue threads, approve actions, review diffs, see screenshots, and get notified when work completes
  - the remote client inherits the host machine’s projects, threads, credentials, permissions, plugins, browser setup, and local tools
  - mobile setup starts from the desktop app, which shows a QR code for ChatGPT mobile to pair with the host
  - connected-device settings can keep the host awake and enable Computer Use or the Chrome extension remotely
  - the same doc positions SSH-host projects as another remote-connection target
  - the May 14, 2026 launch expanded the mobile client into a full multi-thread supervision surface where users can review outputs, approve commands, change models, and start new work while the host keeps the files and credentials
  - OpenAI says the relay layer keeps trusted machines reachable without exposing them directly to the public internet
- Latest development checkpoint:
  - Codex now frames remote operation as full host continuity rather than just log viewing, with live thread state, approvals, plugins, and project context following the user onto mobile

## Product signal
Codex is treating the developer workstation as a remotely steerable agent host whose full tool stack can be supervised from another device without relocating the sensitive local environment.
