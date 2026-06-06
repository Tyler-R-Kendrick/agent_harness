# Browser Admin Panel For Gateway MCP And Memory

- Harness: Hermes Agent
- Sourced: 2026-06-06

## What it is
Hermes now exposes a browser-native administration plane where operators can configure channels, MCP catalog entries, credentials, webhooks, memory, and system controls without dropping into YAML or SSH.

## Evidence
- Official docs: [Web Dashboard](https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard)
- Official release: [Hermes Agent v0.16.0](https://github.com/NousResearch/hermes-agent/releases)
- First-party details:
  - the `v0.16.0` release says the dashboard now includes a full browser-based administration panel
  - the release calls out a Channels page for configuring messaging platforms from the browser
  - the same release adds admin pages for the MCP catalog, credentials, webhooks, memory, gateway controls, and a System page with update and debug-share actions
  - the release also mentions pluggable OIDC and username-password login for the browser surface
  - the dashboard docs continue to position the web UI as the place to manage settings, keys, sessions, and config instead of editing files directly
- Latest development checkpoint:
  - the current first-party release line turns the dashboard from "browser view over a local agent" into a runtime administration console with both operator observability and live configuration duties

## Product signal
Hermes is betting that agent infrastructure needs a browser-native control plane for wiring and governance, not just for reading logs after the fact.
