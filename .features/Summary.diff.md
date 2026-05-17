# Summary Diff For Linear Feature Generation

Updated: 2026-05-17
Baseline: `.features/Summary.md` refreshed from the 2026-05-16 Codex-updated corpus.
Diff type: additive update after OpenAI Symphony feature refresh

## Net new normalized features

### Added: Operator control consoles with blocked-state queues and durable usage ledgers
- Why now: the refreshed OpenAI Symphony corpus shows a current orchestration harness turning live supervision, blocked-session handling, and durable usage accounting into explicit product features.
- Research delta:
  - OpenAI Symphony PR #68 adds selectable running sessions with current stage, checklist payloads, workspace metadata, and bounded recent Codex activity inside the dashboard
  - OpenAI Symphony PR #66 adds a blocked-session state for `input-required` and MCP elicitation events instead of retrying them like transient failures
  - OpenAI Symphony PR #60 persists per-issue token totals in a JSONL ledger and exposes ledger-backed summaries in the observability API
  - the current Elixir README documents a real dashboard plus `/api/v1/*` debugging API, reinforcing that the operator surface is part of the product shape, not a future admin add-on

### Expanded: Parallel agent orchestration
- Why now: the Symphony refresh makes orchestration less abstract and more like a supervised control room.
- Research delta:
  - the running-session dashboard now exposes stage, checklist, and recent activity instead of only listing that a run exists
  - blocked sessions stay claimed and visible until routing changes, which implies orchestration owns pause-state supervision as well as dispatch

### Expanded: Hybrid local, worktree, and cloud execution portability
- Why now: the Symphony refresh adds stronger evidence that orchestration products are validating mixed execution backends, not just talking about them.
- Research delta:
  - the current Elixir README documents a live `make e2e` flow that runs both local-worker and SSH-worker scenarios
  - the SSH scenario can use disposable localhost workers via `docker compose`, generated keypairs, and mounted Codex auth for transport-realistic testing
  - the same test creates temporary Linear resources, runs a real agent turn, verifies workspace side effects, and closes the issue, showing remote transport parity as an actively exercised path

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: Symphony continues to treat repo-owned workflow policy as the place where privileged runtime behavior is declared.
- Research delta:
  - OpenAI Symphony PR #65 adds `networkAccess: true` at the `WORKFLOW.md` turn-sandbox layer for package-manager and external-host bootstrap flows
  - the rationale keeps safer defaults intact and scopes the permission increase to the checked-in workflow contract instead of global runtime configuration

### Added: Add an operator console with blocked-session queues and durable run ledgers
- Why now: `agent-browser` already has sessions, evidence surfaces, and worktree support, but it still lacks one explicit operator surface that shows what every long-running agent is doing, what is blocked on a human, and what each run is consuming over time.
- Linear issue:
  - `TK-66`
- Linear issue title:
  - `Add an operator console with blocked-session queues and durable run ledgers`
- Suggested problem statement:
  - `agent-browser` can show session state and artifacts, but it does not yet provide a dedicated operator console that surfaces current stage, checklist progress, recent activity, blocked-on-human states, and durable token or cost accounting across long-running runs. When a run stalls on input or burns resources over time, the user still has to reconstruct that story from scattered session views and transient transcript details.`
- One-shot instruction for an LLM:
  - Implement an operator console for `agent-browser` that shows all active and blocked runs in one place, exposes current stage, checklist progress, recent events, workspace metadata, and durable token or cost ledgers per run, and treats human-input blockers as a visible queue with explicit unblock actions instead of hidden retry loops; wire this into session storage, artifact rendering, approval state, and any existing remote supervision surfaces so long-running agent work is operable without reading raw transcripts.
