# Summary Diff For Linear Feature Generation

Updated: 2026-05-31
Baseline: `.features/Summary.md` refreshed through the 2026-05-30 GitHub Copilot corpus.
Diff type: additive updates after the 2026-05-31 Warp refresh

## Net new normalized features

### Added: Multi-harness cloud control planes with shared memory and least-privilege governance
- Why now: the refreshed Warp corpus shows the competitive layer moving above any one coding agent. Warp is now packaging orchestration, memory, audit, and access control as a cloud control plane that can supervise Codex, Claude Code, and Warp Agent together.
- Research delta:
  - Warp launched Oz as a multi-harness cloud control plane that can run Claude Code and Codex in addition to Warp Agent
  - the same launch added automatic subagent orchestration across harnesses with one management interface and one audit trail
  - Warp introduced cross-harness Agent Memory in research preview so memories can be formed from Codex and Claude Code sessions and reused by later runs
  - the memory layer is writable and pluggable, with sources spanning files, skills, MCPs, databases, and enterprise apps
  - Warp pairs that orchestration layer with per-team billing, individual credit caps, and least-privilege access to internal services instead of leaving governance inside each harness
  - Warp also expanded self-hosting choices so the same control plane can target Kubernetes, direct execution, and existing remote development environments

## Expanded normalized features

### Expanded: Hybrid local, worktree, and cloud execution portability
- Why now: Warp is turning execution portability into a first-class contract not only across local and cloud environments, but also across harnesses and self-hosting models.
- Research delta:
  - Warp now supports multi-harness cloud execution for Codex and Claude Code in the same Oz surface that already managed Warp Agent
  - Warp says the same orchestration layer can hand work across local, remote, and self-hosted environments while preserving tracking, steering, and artifacts
  - Warp's latest self-hosting options explicitly include Kubernetes, direct execution, and existing remote development environments rather than only Warp-managed sandboxes

### Expanded: Git/PR-native execution
- Why now: Warp is now exposing its own issue-to-PR development loop as part of the product story, not just as an internal process.
- Research delta:
  - Warp says public GitHub issues now act as the system of record for features, roadmap, and discussion
  - Oz is described as triaging issues, asking clarifying questions, generating plans, writing code, and opening pull requests in the open
  - session links, reviews, and progress visibility are part of the contribution model, which turns public issue handling into a first-class harness surface

## Linear-ready feature payloads

### Proposed Linear feature: Add a multi-harness control plane with shared memory and policy enforcement
- Linear issue title:
  - `Add a multi-harness control plane with shared memory and policy enforcement`
- Suggested problem statement:
  - `agent-browser` is still centered on its own runtime, but the market is moving toward control planes that can supervise multiple harnesses without giving up one shared operator surface, one audit model, or one memory layer. Teams increasingly want to run the best harness for a given task, compare outcomes across harnesses, and preserve governance, cost controls, and durable knowledge above that runtime choice. Without a control-plane layer, every new harness integration risks fragmenting approvals, memory, observability, and handoff semantics. The product needs a way to launch approved external harnesses under one governed execution model while keeping cross-harness memory and least-privilege access explicit and reviewable.`
- One-shot instruction for an LLM:
  - Implement a multi-harness control plane for `agent-browser`: let operators register approved external harness runtimes, launch them from the same task intake flow, and supervise them from one shared operator console; preserve one cross-harness run ledger with status, cost, artifacts, approvals, and handoff history; add a shared memory layer with provenance so successful patterns learned from one harness can be reviewed and reused by another; enforce least-privilege access policies and per-run capability boundaries above the runtime layer; support self-hosted and managed execution targets; and keep the user-facing workflow consistent whether the work runs in the native `agent-browser` runtime or an attached external harness.
