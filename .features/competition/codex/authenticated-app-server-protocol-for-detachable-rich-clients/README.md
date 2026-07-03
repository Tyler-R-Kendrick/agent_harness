# Authenticated App-Server Protocol For Detachable Rich Clients

- Harness: Codex
- Sourced: 2026-06-12

## What it is
Codex exposes the same app-server protocol that powers its own rich clients so other products or remote terminals can attach to a live Codex runtime instead of embedding one fixed UI. The protocol carries authentication, thread history, streamed turn events, approvals, steering, schema generation, and experimental capability gating.

## Evidence
- OpenAI Developers: [Codex App Server](https://developers.openai.com/codex/app-server)
- OpenAI Developers: [Codex CLI features](https://developers.openai.com/codex/cli/features)
- OpenAI Developers: [Command line options](https://developers.openai.com/codex/cli/reference)
- Key details:
  - `codex app-server` is documented as the interface that powers rich clients such as the Codex VS Code extension, not just a private internal transport.
  - the protocol uses bidirectional JSON-RPC 2.0 semantics over `stdio`, WebSocket, or Unix-socket transports, which makes Codex detachable from any single shell or desktop shell
  - the runtime exposes thread and turn lifecycle primitives including `thread/start`, `thread/resume`, `thread/fork`, `turn/start`, and `turn/steer`
  - approvals are first-class protocol messages, so remote clients can present command, file, and user-input decisions without re-implementing the runtime
  - WebSocket exposure supports capability-token or signed-bearer-token auth and explicitly documents health probes, overload behavior, and retry expectations
  - the CLI can attach to a remote app-server with `codex --remote ...`, which turns the TUI itself into a detachable client for another machine's active runtime
  - schema generation commands (`generate-ts`, `generate-json-schema`) let integrators pin a version-matched contract instead of scraping transient event shapes
  - experimental APIs are capability-gated during `initialize`, which gives Codex a compatibility story for evolving richer clients without silently breaking stable integrations

## Latest development checkpoint
- current first-party docs now make Codex's client/runtime split much more explicit than the older "CLI plus app plus IDE" framing
- the most meaningful shift is that Codex is documenting a reusable operator protocol for rich clients, remote TUIs, and product embeddings rather than treating each surface as a separate monolith

## Screenshots and demos
- Official visuals exist for the IDE extension and Codex app surfaces that sit on top of the same runtime.
- The app-server page includes protocol examples rather than UI screenshots; the visible product evidence is strongest in the IDE-extension docs and Codex app materials.

## Product signal
This points toward a harness architecture where the agent runtime, approvals engine, and thread state are stable shared infrastructure, while terminal, IDE, browser, and embedded-product clients become swappable front ends. That separation is strategically stronger than shipping each client as a one-off wrapper around a private local process.
