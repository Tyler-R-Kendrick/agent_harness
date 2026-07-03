# Summary Diff For Linear Feature Generation

Updated: 2026-06-12
Baseline: `.features/Summary.md` refreshed through the 2026-06-11 OpenClaw corpus.
Diff type: additive updates after the 2026-06-12 Codex refresh

## Net new normalized features

### Added: Authenticated app-server protocols for detachable rich clients
- Why now: the refreshed Codex corpus now documents Codex's app-server as a first-party integration surface rather than just an implementation detail behind the app and IDE. That makes the client/runtime split explicit and productized.
- Research delta:
  - current Codex docs describe `codex app-server` as the interface used to power rich clients such as the Codex VS Code extension, with JSON-RPC thread, turn, steering, and approval flows
  - the CLI can attach to another machine's live runtime with `codex --remote ...`, which turns the terminal UI into a detachable client instead of the only place where the runtime can live
  - remote app-server use documents capability-token and signed-bearer-token auth, health probes, bounded-queue overload behavior, and retry expectations, which shows a more mature remote-client contract than a best-effort local socket
  - schema-generation commands for TypeScript and JSON Schema let integrators pin the contract to a specific Codex version
  - experimental fields and methods are gated through initialize-time client capabilities, which gives Codex a versioning and compatibility story for richer clients

## Expanded normalized features

### Expanded: Multi-surface continuity
- Why now: the Codex refresh sharpens continuity from "same thread across app, CLI, IDE, cloud, and phone" into "same runtime contract can be driven by multiple detachable clients."
- Research delta:
  - the operator surface is not just portable at the UX layer; the runtime itself is now exposed as a reusable client protocol
  - this reduces the need for each new client to embed private orchestration and approval logic, which lowers the barrier to adding future surfaces

## Linear-ready feature payloads

### Proposed Linear feature: Add an authenticated app-server protocol for detachable agent-browser clients
- Linear issue title:
  - `Add an authenticated app-server protocol for detachable agent-browser clients`
- Suggested problem statement:
  - `agent-browser` currently treats its UI surfaces as tightly coupled to the runtime that executes agent turns. Competitors are starting to separate those layers. Codex now exposes a first-party app-server protocol that powers rich clients like the IDE extension, lets a remote terminal attach to the same live runtime, carries approvals and steering as protocol messages, supports explicit remote authentication, and publishes version-matched schemas for integrators. Without a comparable protocol, `agent-browser` has to re-embed orchestration, approvals, and event-stream handling in each surface we build, which makes new clients harder to ship and remote supervision harder to standardize. The product needs a stable runtime contract that lets browser, IDE, terminal, and embedded clients attach to one live agent session with explicit authentication and compatibility boundaries.`
- One-shot instruction for an LLM:
  - Implement an authenticated app-server protocol for `agent-browser` that exposes threads, turns, in-flight steering, approvals, tool events, file or artifact updates, and status notifications over a stable transport contract; support local transports first and authenticated remote attachment second; let thin clients such as a browser console, IDE panel, or terminal attach to the same runtime session; generate version-matched TypeScript and JSON Schema artifacts for integrators; and gate experimental methods or fields behind declared client capabilities so the runtime can evolve without breaking stable detachable clients.
