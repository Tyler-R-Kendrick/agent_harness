# Linear GraphQL Tool And Agent-Side Ticket Ops

- Harness: OpenAI Symphony
- Sourced: 2026-04-30

## What it is
Symphony keeps tracker mutations in the agent toolchain by optionally exposing a client-side `linear_graphql` tool during Codex app-server sessions.

## Evidence
- Official spec: [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Elixir reference docs: [elixir/README.md](https://github.com/openai/symphony/blob/main/elixir/README.md)
- First-party details:
  - the spec says Symphony itself is primarily a scheduler, runner, and tracker reader, while ticket writes are typically handled by the coding agent
  - the current standardized optional client-side tool in the spec is `linear_graphql`
  - the tool can be advertised to the app-server session during startup, and unsupported tool names should fail without stalling the run
  - the Elixir reference says the `linear` repo skill expects this tool for raw Linear GraphQL operations such as comment editing or upload flows
- Latest development checkpoint:
  - the initial public materials explicitly separated orchestration policy from ticket mutation logic and shipped a concrete tool bridge for Linear on April 27, 2026

## Product signal
Symphony is showing a clean pattern where the orchestrator stays narrow while the agent gets richer issue-tracker actions through explicit tool contracts.
