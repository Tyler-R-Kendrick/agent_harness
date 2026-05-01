# Embeddable Runtimes JSON RPC And SDK

- Harness: Pi
- Sourced: 2026-04-30

## What it is
Pi is not only an interactive CLI. It also runs in print or JSON modes, exposes a documented JSON-RPC protocol over stdin/stdout, and ships an SDK so the coding harness can be embedded inside other apps and UIs.

## Evidence
- Official coding-agent README: [packages/coding-agent/README.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md)
- Official RPC docs: [docs/rpc.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/rpc.md)
- First-party details:
  - the README says Pi runs in interactive, print or JSON, RPC, and SDK modes
  - the RPC docs describe headless operation over stdin/stdout with JSON commands, request IDs, streamed agent events, and strict JSONL framing rules
  - the same docs recommend using `AgentSession` directly for Node.js and TypeScript embeddings instead of spawning a subprocess
  - the README points to OpenClaw as a real-world SDK integration
- Latest development checkpoint:
  - recent release notes keep expanding transport, provider, and extension behaviors in ways that benefit both the interactive CLI and embedded consumers

## Product signal
Pi is unusually explicit that a coding harness should also be a reusable runtime layer, which is strategically relevant for IDEs, browsers, chat surfaces, and orchestrators that do not want to shell out to a human-facing CLI.
