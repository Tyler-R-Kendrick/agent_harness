# Plugin Runtime Hooks And Context Engines

- Harness: Hermes Agent
- Sourced: 2026-05-24

## What it is
Hermes exposes a multi-layer plugin system that can add tools and slash commands, intercept runtime events, inject prompt context, ship dashboard tabs, and swap core providers such as memory, context engines, and model backends.

## Evidence
- Official docs: [Plugins](https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins)
- Official docs: [Built-in Plugins](https://hermes-agent.nousresearch.com/docs/user-guide/features/built-in-plugins)
- Official docs: [Event Hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks)
- Official release: [Hermes Agent v0.14.0](https://github.com/NousResearch/hermes-agent/releases)
- First-party details:
  - Hermes documents four plugin categories: general plugins, memory providers, context engines, and model providers
  - plugin hooks can run on `pre_tool_call`, `post_tool_call`, `pre_llm_call`, `post_llm_call`, session lifecycle events, and `subagent_stop`
  - shell hooks can block tool calls or inject context without requiring Python plugin authoring, including Claude-Code-style cwd context injection before every turn
  - built-in plugins now cover dashboard tabs, observability hooks, cleanup lifecycle automation, Meet participation, and image backends, while still using the same opt-in plugin surface as third-party extensions
  - hook failures are documented as fail-open so a broken plugin cannot take down the agent loop
- Latest development checkpoint:
  - the current May 2026 docs show Hermes pushing extensibility deeper into the runtime and operator surfaces instead of limiting plugins to sidecar integrations

## Product signal
Hermes is treating the harness as a host platform with interceptable runtime seams, not just an app with a few extension points.
