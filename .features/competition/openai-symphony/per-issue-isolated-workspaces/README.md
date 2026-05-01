# Per-Issue Isolated Workspaces

- Harness: OpenAI Symphony
- Sourced: 2026-04-30

## What it is
Symphony creates and preserves a separate workspace per issue so each run executes inside a deterministic, issue-scoped filesystem environment.

## Evidence
- Official spec: [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Elixir reference docs: [elixir/README.md](https://github.com/openai/symphony/blob/main/elixir/README.md)
- First-party details:
  - the spec lists deterministic per-issue workspaces as a core goal and says workspaces should persist across runs
  - the workspace manager in the spec maps issue identifiers to workspace paths, ensures those directories exist, runs lifecycle hooks, and cleans terminal-state workspaces
  - the Elixir reference says the service creates a workspace per issue before launching Codex in App Server mode inside that workspace
  - issue identifiers are normalized into workspace-safe keys so the filesystem layout remains stable and predictable
- Latest development checkpoint:
  - the initial public spec and reference implementation both shipped this workspace model as a first-class primitive on April 27, 2026

## Product signal
Symphony treats workspace isolation as orchestration infrastructure rather than an advanced manual trick, which raises the baseline for parallel coding-agent safety and reviewability.
