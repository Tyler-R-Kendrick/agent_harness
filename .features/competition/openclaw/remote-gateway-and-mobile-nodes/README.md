# Remote Gateway And Mobile Nodes

- Harness: OpenClaw
- Sourced: 2026-05-20

## What it is
OpenClaw separates the always-on gateway host from the clients and companion devices that connect to it, including macOS, iOS, and Android nodes that expose local capabilities back to the agent.

## Evidence
- Official docs: [Remote access](https://docs.openclaw.ai/gateway/remote)
- Official docs: [OpenClaw overview](https://docs.openclaw.ai/)
- First-party details:
  - the recommended remote model is one persistent gateway host with clients connecting over SSH tunneling, tailnet access, or managed app support
  - the macOS app supports a dedicated Remote over SSH mode that manages the tunnel for WebChat and health checks
  - nodes connect to the same gateway WebSocket with `role: "node"` and expose command families like `canvas.*`, `camera.*`, `device.*`, `notifications.*`, and `system.*`
  - the overview docs call out paired iOS and Android nodes for Canvas, camera, and voice-enabled workflows
  - the gateway remains the single owner of sessions, channels, auth profiles, and state while nodes act as peripherals
- Latest development checkpoint:
  - the current remote-access docs frame remote operation and node pairing as a first-class deployment topology, not an afterthought for advanced users

## Product signal
OpenClaw is pushing toward an always-on personal agent architecture where the agent lives on one host and selectively reaches operator devices as peripherals for voice, canvas, camera, and remote control.
