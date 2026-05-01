# Desktop App Self Hosting And Zero Downtime Supervise

- Harness: Space Agent
- Sourced: 2026-04-30

## What it is
Space Agent ships as both a native desktop app and a self-hosted server, and its production CLI includes a supervised mode positioned for zero-downtime updates.

## Evidence
- Official README: [agent0ai/space-agent](https://github.com/agent0ai/space-agent)
- Official releases: [agent0ai/space-agent releases](https://github.com/agent0ai/space-agent/releases)
- Official product site: [space-agent.ai login](https://space-agent.ai/login)
- First-party details:
  - the README says the latest desktop build runs everything as one app with no terminal required
  - the same page documents self-hosted startup with `node space serve`
  - production guidance includes `node space supervise HOST=0.0.0.0 PORT=3000` and labels it zero-downtime auto-update
  - the releases page publishes native builds for macOS, Linux, and Windows
  - the hosted login page separates the native app from the own-server option and says both include full extensibility and all features
- Latest development checkpoint:
  - the latest public release is `v0.66`, published on April 30, 2026, with cross-platform binaries, which indicates the desktop-distribution path is active and current

## Product signal
Space Agent is treating packaging and deployment as part of the harness experience, not just as a developer setup detail.
