# Parallel Sub-Agents

- Harness: Hermes Agent
- Sourced: 2026-05-15

## What it is
Hermes supports delegated sub-agents for parallel work, and its newer runtime adds more explicit orchestrator behavior and worker coordination so delegation is not just "spawn helpers and hope."

## Evidence
- Official site: [Hermes Agent](https://hermes-agent.org/)
- Official release: [Hermes Agent v0.11.0](https://github.com/NousResearch/hermes-agent/releases)
- First-party details:
  - the product site says Hermes can spawn isolated sub-agents, each with its own conversation and terminal
  - the v0.11.0 release says subagents now have an explicit `orchestrator` role that can spawn workers with configurable `max_spawn_depth`
  - the same release says concurrent sibling subagents share filesystem state through a coordination layer so they do not clobber each other's edits
- Latest development checkpoint:
  - current first-party release notes are moving Hermes from basic helper spawning toward explicitly modeled orchestration and shared-state coordination

## Product signal
Hermes is treating delegation as a runtime discipline with roles and coordination semantics, not just a prompting trick.
