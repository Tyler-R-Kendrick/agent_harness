# Files To Copy And Worktreeinclude Bootstrap

- Harness: Conductor
- Sourced: 2026-05-12

## What it is
Conductor can automatically carry selected local or gitignored files into each new workspace, giving teams a way to preserve high-value local setup and secrets-adjacent scaffolding across branch-isolated runs.

## Evidence
- Official docs: [Files to copy](https://www.conductor.build/docs/reference/files-to-copy)
- Official changelog: [v0.51.0](https://www.conductor.build/changelog/0.51.0)
- First-party details:
  - users can define files and directories that should be copied into every new workspace
  - `.worktreeinclude` is part of the mechanism for carrying local-only workspace inputs forward
  - the docs frame this as a way to avoid redoing setup for ignored or user-local files in each isolated workspace
  - `v0.51.0` adds support for copying directories, not only single files
- Latest development checkpoint:
  - the April 25, 2026 `v0.51.0` release expanded the feature from file copy to directory copy, which makes it much more useful for real developer environments

## Product signal
This points to a growing need for harnesses to manage the messy boundary between reproducible isolated workspaces and the local state developers still depend on.
