# Summary Diff For Linear Feature Generation

Updated: 2026-06-10
Baseline: `.features/Summary.md` refreshed through the 2026-06-09 GitHub Copilot corpus.
Diff type: additive updates after the 2026-06-10 Mastra refresh

## Net new normalized features

### Added: Per-request workspace sandboxes with resumable background continuity
- Why now: the refreshed Mastra corpus now has a precise first-party runtime contract for request-scoped sandbox routing, background-process continuity, and unified long-running stream resumption that was not captured in the earlier Mastra slice.
- Research delta:
  - the June 4, 2026 Mastra release says `Workspace.sandbox` can now be a resolver function, which means one workspace can route each request into a different isolated sandbox based on request context
  - resolver-backed workspaces now default to stable placeholder instructions so prompt construction does not provision or leak a caller-owned sandbox unless `instructions.dynamicSandbox` explicitly opts in
  - Mastra added `sandboxCacheKey` so `execute_command({ background: true })`, `get_process_output`, and `kill_process` can keep using the same sandbox across follow-up requests instead of losing continuity
  - the same release unifies long-running stream continuity under `stream(..., { untilIdle: true })` and `resumeStream(..., { untilIdle: true })`, deprecating separate `*UntilIdle` methods and endpoints
  - this ties sandbox routing, background work, and resumed streaming into one coherent runtime surface rather than scattered primitives

## Expanded normalized features

### Expanded: Scheduled automations and background execution
- Why now: the refreshed Mastra corpus shows stronger continuity guarantees for long-running and resumed execution than the current background-work summary captured.
- Research delta:
  - Mastra is no longer just exposing background-process handles; it now gives those handles a stable sandbox attachment path across follow-up turns
  - the new `untilIdle` stream and resume contract means long-running work can stay visible through one shared continuation primitive instead of separate special-case endpoints
  - this pushes the broader background-execution pattern toward explicit runtime continuity, not just "run later and hope the state still lines up"

## Linear-ready feature payloads

### Proposed Linear feature: Add per-request workspace sandboxes with resumable background continuity
- Linear issue title:
  - `Add per-request workspace sandboxes with resumable background continuity`
- Suggested problem statement:
  - `agent-browser` can already run local or worktree-scoped tasks, but its execution environment is still mostly selected up front and treated as fixed for the life of the run. Competitors are now making sandbox choice part of request routing itself, so the same workspace can place each run into the right isolated environment for that user, thread, or policy context while still preserving continuity for background commands and resumed streams. Mastra now couples request-scoped sandbox resolution with a stable cache key for background-process follow-through and a unified \`untilIdle\` stream or resume contract. Without a similar model, agent-browser will keep forcing operators to choose between fine-grained isolation and reliable long-running execution continuity. The product needs request-scoped sandbox resolution, durable sandbox bindings for resumed work, and one shared continuation contract for long-running foreground and background sessions.`
- One-shot instruction for an LLM:
  - Implement per-request workspace sandboxes for `agent-browser`: let a workspace or run resolve its sandbox from request context such as user, thread, task, or policy; keep prompt construction stable until a concrete sandbox is needed; add a durable sandbox binding key so background commands, process output, kill operations, and resumed runs reconnect to the same isolated environment; expose operator controls to inspect, clear, or rotate those bindings when a sandbox is replaced; and unify long-running stream continuation behind one `until_idle` option for both initial and resumed runs instead of maintaining separate continuation-only APIs.
