# Plugin Runtime Hooks And Context Engines

- Harness: Hermes Agent
- Sourced: 2026-05-15

## What it is
Hermes exposes a multi-layer plugin system that can add tools and slash commands, intercept tool calls, inject prompt context, swap memory providers, replace context engines, and register new model providers.

## Evidence
- Official docs: [Plugins](https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins)
- Official docs: [Event Hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks)
- Official release: [Hermes Agent v0.11.0](https://github.com/NousResearch/hermes-agent/releases)
- First-party details:
  - Hermes documents four plugin categories: general plugins, memory providers, context engines, and model providers
  - plugin hooks can run on `pre_tool_call`, `post_tool_call`, `pre_llm_call`, `post_llm_call`, session lifecycle events, and `subagent_stop`
  - shell hooks can block tool calls or inject context without requiring Python plugin authoring
  - the `v0.11.0` release expanded the surface so plugins can register slash commands, dispatch tools, veto tool execution, rewrite tool results, transform terminal output, and add dashboard tabs
- Latest development checkpoint:
  - the current docs and April 23, 2026 `v0.11.0` release show Hermes pushing extensibility into the runtime path itself rather than limiting plugins to sidecar integrations

## Product signal
Hermes is treating the harness as a host platform with interceptable runtime seams, not just an app with a few extension points.
