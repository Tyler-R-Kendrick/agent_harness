# Full System Access And Self-Hosting

- Harness: OpenClaw
- Sourced: 2026-05-20

## What it is
OpenClaw is built as a self-hosted gateway that owns sessions, auth, channels, and tool execution on hardware the user controls, while still supporting remote supervision over SSH or tailnet access.

## Evidence
- Official docs: [OpenClaw overview](https://docs.openclaw.ai/)
- Official docs: [Remote access](https://docs.openclaw.ai/gateway/remote)
- GitHub repo: [openclaw/openclaw](https://github.com/openclaw/openclaw)
- First-party details:
  - OpenClaw is explicitly described as a self-hosted gateway that runs on the user's own machine or server
  - the gateway host owns sessions, auth profiles, channels, and state, while clients and nodes connect to it remotely
  - SSH tunneling is documented as the universal remote fallback, and Tailscale Serve is the preferred path when identity-aware HTTPS is available
  - the repo README still positions the gateway as the control plane and the assistant as the product
- Latest development checkpoint:
  - current docs and the stable `2026.5.18` release continue to reinforce self-hosting and remote-gateway operation as the default architecture rather than a community-maintained side path

## Product signal
OpenClaw is competing on sovereignty and portability: keep the agent on infrastructure you control, then bring operator surfaces and devices to that gateway as needed.
