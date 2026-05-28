# Workspacewrite Policies Retain Issue Workspace Roots

- Harness: OpenAI Symphony
- Sourced: 2026-05-28

## What it is
Symphony is tightening explicit `workspaceWrite` sandbox policies without sacrificing the active issue workspace: when extra writable roots are supplied, the runtime prepends the current issue workspace so normal edits still work.

## Evidence
- Open PR: [#58 Retain issue roots in explicit workspaceWrite policies](https://github.com/openai/symphony/pull/58)
- Official spec: [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Elixir reference docs: [elixir/README.md](https://github.com/openai/symphony/blob/main/elixir/README.md)
- First-party details:
  - PR #58 says explicit `workspaceWrite` policies should keep the current issue workspace writable while still allowing extra roots such as linked-worktree `.git` metadata
  - the PR summary says the runtime prepends the current issue workspace to explicit `workspaceWrite` policies, leaves non-`workspaceWrite` policies unchanged, and updates config, app-server, and runtime tests around that contract
  - the spec requires the coding agent `cwd` to be the per-issue workspace path and treats filesystem safety for that workspace as a core invariant
  - the Elixir reference keeps the per-issue workspace as the execution root for real local and SSH-backed end-to-end runs, so preserving that root in sandbox policy composition is operationally significant rather than cosmetic
- Latest development checkpoint:
  - as of May 28, 2026, PR #58 is still open in the public repo, but it already has multiple approvals and documents a concrete portability hardening step for issue-scoped workspaces

## Product signal
Symphony exposes a subtle but important harness rule: explicit writable-root policies should extend the active issue workspace, not accidentally replace it, or least-privilege hardening turns into self-inflicted filesystem breakage.
