# Custom Subagents With Permission Scopes

- Harness: Kilo Code
- Sourced: 2026-05-07

## What it is
Kilo exposes configurable subagents that run in isolated sessions with their own prompts, models, and tool permissions, so teams can build narrow specialists instead of relying only on one general-purpose agent.

## Evidence
- Official docs: [Custom Subagents](https://kilo.ai/docs/customize/custom-subagents)
- Official docs: [Code with AI](https://kilo.ai/docs/code-with-ai)
- First-party details:
  - Kilo says subagents run in isolated context with separate conversation history
  - custom subagents can be defined in `kilo.jsonc` or as markdown files under `.kilo/agents/`
  - permissions can be set per tool as `allow`, `ask`, or `deny`, including globbed rules for bash commands
  - a primary agent can be restricted to invoking only specific subagents through `permission.task`
  - subagents can be invoked automatically through the Task tool or manually with `@agent-name`
  - Kilo includes built-in `general` and read-only `explore` subagents
- Latest development checkpoint:
  - the current docs show Kilo moving specialist-agent design into ordinary configuration rather than leaving delegation as a hidden internal behavior

## Product signal
Kilo is operationalizing delegation with explicit isolation and permission scoping, which makes specialist-agent systems easier to trust and compose.