# Per-Issue Isolated Workspaces

- Harness: OpenAI Symphony
- Sourced: 2026-05-17

## What it is
Symphony creates and preserves a separate workspace per issue so each run executes inside a deterministic, issue-scoped filesystem environment, then validates the orchestration flow across both local and SSH worker transports.

## Evidence
- Official spec: [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Elixir reference docs: [elixir/README.md](https://github.com/openai/symphony/blob/main/elixir/README.md)
- First-party details:
  - the spec lists deterministic per-issue workspaces as a core goal and says workspaces should persist across runs
  - the workspace manager in the spec maps issue identifiers to workspace paths, ensures those directories exist, runs lifecycle hooks, and cleans terminal-state workspaces
  - the Elixir reference says the service creates a workspace per issue before launching Codex in App Server mode inside that workspace
  - issue identifiers are normalized into workspace-safe keys so the filesystem layout remains stable and predictable
  - the current Elixir README says `make e2e` runs one live scenario with a local worker and one with SSH workers, using disposable localhost SSH workers when external hosts are not configured
  - the same live test writes a temporary `WORKFLOW.md`, launches a real agent turn, verifies the workspace side effect, requires the agent to comment on and close the Linear issue, and keeps the finished run visible in Linear
- Latest development checkpoint:
  - the May 2026 Elixir docs turn per-issue workspaces into a transport-tested contract rather than a local-only assumption

## Product signal
Symphony treats workspace isolation as orchestration infrastructure rather than an advanced manual trick, and it is already validating that model across mixed worker transports that resemble real remote execution fleets.
