# Per-Request Workspace Sandboxes And Unified Until-Idle Streaming

- Harness: Mastra
- Sourced: 2026-06-04

## What it is
Mastra now lets a workspace resolve its sandbox per request, keep background-process tools attached to that same sandbox across follow-up turns, and unify long-running stream continuity behind a single `untilIdle` contract.

## Evidence
- Official releases: [mastra-ai/mastra releases](https://github.com/mastra-ai/mastra/releases)
- First-party details:
  - the June 4, 2026 `@mastra/core@1.41.0` release says `Workspace.sandbox` can now be a resolver function, which enables per-request sandbox routing for multi-tenant deployments with isolated working directories and permission sets
  - the same release says resolver-backed workspaces now use stable placeholder instructions by default, with `instructions.dynamicSandbox` as the opt-in path when the prompt should reflect a concrete request-scoped sandbox
  - Mastra added `sandboxCacheKey` so `execute_command({ background: true })`, `get_process_output`, and `kill_process` can keep using the same sandbox across follow-up requests instead of losing process continuity
  - the release also says `stream()` and `resumeStream()` now accept `untilIdle`, and the dedicated `streamUntilIdle()` plus `resumeStreamUntilIdle()` methods and endpoints are deprecated in favor of one shared stream or resume contract
- Latest development checkpoint:
  - by early June 2026 Mastra had tightened the handoff between multi-tenant isolation, background-process continuity, and resumed streaming instead of treating them as separate runtime features

## Product signal
Mastra is moving toward request-scoped execution environments that can survive long-running agent work without losing the exact sandbox, process handles, or stream semantics that the run started with. That is a strong harness signal because multi-tenant isolation becomes much more useful once background work can continue safely across pauses, resumes, and operator follow-up.
