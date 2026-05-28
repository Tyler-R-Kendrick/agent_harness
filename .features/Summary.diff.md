# Summary Diff For Linear Feature Generation

Updated: 2026-05-28
Baseline: `.features/Summary.md` refreshed from the 2026-05-27 corpus.
Diff type: additive update after OpenAI Symphony refresh

## Net new normalized features

### Added: Explicit writable-root policies that preserve the active issue workspace
- Why now: the OpenAI Symphony refresh surfaced a first-party hardening pattern for issue-scoped workspaces. Explicit `workspaceWrite` roots should extend the active issue workspace, not replace it.
- Research delta:
  - PR `#58` says Symphony should keep the current issue workspace writable even when operators or workflows pass explicit `workspaceWrite` roots for linked-worktree `.git` metadata or other extra writable paths
  - the PR summary says the runtime prepends the current issue workspace to explicit `workspaceWrite` policies and leaves non-`workspaceWrite` policies unchanged
  - the public spec already treats the per-issue workspace path as a safety invariant for `cwd`, which makes this an important contract-composition fix rather than a convenience tweak
  - the Elixir reference validates real local and SSH worker runs inside per-issue workspaces, so preserving that root in the effective writable set matters for real transport-backed orchestration

## Linear-ready feature payload

### Linear issue title
- `Add explicit writable-root policies that preserve the active issue workspace`

### Suggested problem statement
- `agent-browser` already supports sandbox and worktree-oriented execution, but explicit writable-root configuration is fragile. When users, workflows, or runtime helpers add extra writable roots such as linked-worktree `.git` metadata, cache directories, or other task-adjacent paths, it is too easy for that explicit list to replace the current issue or worktree root instead of extending it. That breaks ordinary editing in subtle ways and forces operators to over-broaden filesystem permissions just to keep the active task writable. The harness needs a clear composition rule where the current task workspace remains writable by default and extra roots are additive, inspectable, and test-covered.

### One-shot instruction for an LLM
- Implement explicit writable-root policy composition for `agent-browser`: when a run, workflow, or integration supplies extra writable roots, automatically retain the current issue or worktree root in the effective writable set, keep non-filesystem sandbox policies unchanged, surface the final writable-root list in the run UI or logs, support extra roots such as linked-worktree `.git` metadata and cache directories without broadening to the whole repo, and cover the contract with config, runtime, and app-server regression tests.
