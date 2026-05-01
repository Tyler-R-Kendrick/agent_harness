# WORKFLOW.md Contract And Live Reload

- Harness: OpenAI Symphony
- Sourced: 2026-04-30

## What it is
Symphony stores runtime policy and the per-issue prompt template in a repository-owned `WORKFLOW.md` file with YAML front matter, then requires live reload when that contract changes.

## Evidence
- Official spec: [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Elixir reference docs: [elixir/README.md](https://github.com/openai/symphony/blob/main/elixir/README.md)
- First-party details:
  - the spec says workflow policy should live in-repo so teams version agent prompts and runtime settings with their code
  - `WORKFLOW.md` can define tracker settings, polling, workspace root, hooks, agent concurrency, and Codex runtime configuration
  - prompt rendering is strict: unknown variables and filters must fail rather than silently degrade
  - dynamic reload is required, and invalid reloads must keep the last known good configuration running instead of crashing the service
  - the Elixir reference defaults to `./WORKFLOW.md` and documents it as the main contract for configuration plus prompt content
- Latest development checkpoint:
  - the April 27, 2026 public launch made `WORKFLOW.md` the portability seam for both the spec and the prototype implementation

## Product signal
Symphony productizes repository-owned agent policy as a live operational contract, which is more rigorous than scattered prompt snippets or hidden runtime settings.
