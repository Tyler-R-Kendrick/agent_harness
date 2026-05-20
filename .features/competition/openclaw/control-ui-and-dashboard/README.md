# Control UI And Dashboard

- Harness: OpenClaw
- Sourced: 2026-05-20

## What it is
OpenClaw ships a browser-native operator surface for chat, config, sessions, nodes, and approvals, with security and remote-access behavior documented as part of the primary product.

## Evidence
- Official docs: [Control UI](https://docs.openclaw.ai/control-ui)
- Official docs: [Dashboard](https://docs.openclaw.ai/dashboard)
- Official docs: [Configuration](https://docs.openclaw.ai/gateway/configuration)
- First-party details:
  - the Control UI is a Vite and Lit single-page app served by the gateway on the same port as the WebSocket control plane
  - the dashboard is explicitly positioned as an admin surface for chat, config, and exec approvals
  - the UI supports browser-local personal identity and avatar overrides for shared-session attribution
  - config editing is schema-driven, with `config.schema` and `config.schema.lookup` powering form rendering, plus a guarded Raw JSON mode when safe round-tripping is possible
  - `openclaw dashboard` can reopen the UI, bootstrap auth safely, and preserve tokens in `sessionStorage` rather than `localStorage`
- Latest development checkpoint:
  - the stable `2026.5.18` release calls out faster settings, cleaner chat and session controls, responsive logs, remote gateway setup, and a native dashboard as part of the consolidated changes

## Product signal
OpenClaw is investing in an operator console, not only chat ingress. The harness increasingly expects live browser supervision, config surgery, and session administration to be part of normal use.
