# Summary Diff For Linear Feature Generation

Updated: 2026-06-07
Baseline: `.features/Summary.md` refreshed through the 2026-06-06 Hermes Agent corpus.
Diff type: additive updates after the 2026-06-07 OpenAI Symphony refresh

## Net new normalized features

### Added: Tracker-backed claim leases with heartbeat expiry and restart recovery
- Why now: the refreshed OpenAI Symphony corpus adds a first-party lease layer that persists worker ownership in the tracker and then extends that model into Jira.
- Research delta:
  - Symphony PR #82 adds claim lease state with worker id, workspace path, retry attempt, heartbeat timestamp, expiry, and operator-visible recovery events
  - the same PR publishes active, retrying, and blocked lease markers back to the tracker and surfaces that state in the JSON API and LiveView dashboard
  - Symphony PR #83 adds Jira support for reading and upserting those lease markers by editing existing comments instead of appending unbounded heartbeat spam
  - together, the two PRs turn safe restart recovery from an in-memory orchestration detail into a durable tracker contract that can survive daemon restarts and cross-tracker deployments

## Expanded normalized features

### Expanded: Issue-tracker control planes
- Why now: the refreshed OpenAI Symphony corpus shows the tracker evolving from intake queue into durable runtime coordination surface.
- Research delta:
  - Symphony no longer treats tracker state as just task metadata; it now writes lease ownership and recovery state back into tracker comments
  - Jira support means the same runtime coordination contract is being designed to survive beyond one tracker adapter
  - this pushes the broader control-plane idea toward tracker-native ownership, heartbeat, and handoff semantics instead of relying only on local orchestrator memory

## Linear-ready feature payloads

### Proposed Linear feature: Add tracker-backed claim leases with heartbeat expiry and restart recovery
- Linear issue title:
  - `Add tracker-backed claim leases with heartbeat expiry and restart recovery`
- Suggested problem statement:
  - `agent-browser` can run long-lived and background work, but it still lacks a durable ownership contract that survives orchestrator restarts, multiple runners, and tracker reconnects. Competitors are starting to persist worker leases back into the issue tracker with heartbeat, expiry, blocked, and retry state so dispatch recovery does not duplicate live work or silently strand tasks after host failure. Without a tracker-backed lease model, restart recovery stays fragile, operator trust stays low, and multi-runner orchestration cannot scale safely across tracker adapters. The product needs explicit claim leases that are visible in both the tracker and operator UI, portable across tracker providers, and capable of safe handoff when leases expire.`
- One-shot instruction for an LLM:
  - Implement tracker-backed claim leases for `agent-browser`: whenever a task is claimed, persist a durable lease record containing worker id, workspace path, attempt number, heartbeat timestamp, expiry, and blocked or retry state; surface the lease in the operator UI and the tracker itself; refuse duplicate dispatch when an unexpired external lease already exists; recover expired or dead-worker leases by requeueing or handing off the task safely; update existing tracker markers in place when possible to avoid comment spam; and keep the lease abstraction portable so Linear, Jira, and future tracker adapters can share the same ownership and recovery contract.
