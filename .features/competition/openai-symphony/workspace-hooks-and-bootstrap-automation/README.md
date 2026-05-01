# Workspace Hooks And Bootstrap Automation

- Harness: OpenAI Symphony
- Sourced: 2026-04-30

## What it is
Symphony lets repositories automate workspace creation, setup, teardown, and per-run preparation through lifecycle hooks defined in `WORKFLOW.md`.

## Evidence
- Official spec: [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Elixir reference docs: [elixir/README.md](https://github.com/openai/symphony/blob/main/elixir/README.md)
- First-party details:
  - the spec defines `after_create`, `before_run`, `after_run`, and `before_remove` hooks plus a shared timeout
  - hook failures can abort workspace creation or the current attempt when appropriate, while cleanup hooks are best effort
  - the Elixir reference recommends using `after_create` to clone a repo and prepare a fresh workspace before the agent starts
  - the reference also documents environment-variable-backed path and command configuration for portable bootstrap flows
- Latest development checkpoint:
  - the April 27, 2026 public docs framed hooks as part of the core repository contract rather than an implementation-specific extension

## Product signal
Symphony makes repo bootstrap and run hygiene declarative, which lowers the friction of turning an existing codebase into an always-on agent target.
