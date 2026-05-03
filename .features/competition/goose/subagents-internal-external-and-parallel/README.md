# Subagents, Internal, External, And Parallel

- Harness: Goose
- Sourced: 2026-05-03

## What it is
Goose can spin up subagents that execute in isolation, run sequentially or in parallel, inherit or constrain extension access, and even delegate to external agents such as Codex through ACP or MCP wiring.

## Evidence
- Official docs: [Subagents](https://goose-docs.ai/docs/guides/subagents/)
- First-party details:
  - Goose documents autonomous subagent creation in autonomous permission mode.
  - Users can ask Goose to run multiple subagents in parallel or sequential order using natural language.
  - Subagent tool calls are rendered inline so the parent session can inspect real-time execution.
  - Internal subagents inherit current context and can be configured by direct prompts or recipes.
  - External subagents can route work to outside agents, with the docs showing Codex configured as a Goose subagent.
  - Goose enforces explicit subagent restrictions such as no recursive subagent spawning and no schedule management from subagents.
- Latest development checkpoint:
  - Goose's current subagent docs already assume delegation across internal and external agents, which makes multi-agent coordination part of default operation rather than an experimental corner

## Product signal
Goose is building a practical orchestration layer: parallel workers, explicit tool boundaries, and visible execution traces inside the main conversation.
