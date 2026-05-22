# Vibot Design

## Look And Feel

- Vibot presents itself as a complete platform rather than a narrow browser-control bridge.
- The page uses developer SaaS patterns: terminal quick start, feature counters, capability sections, comparison table, and CLI snippets.
- The design puts breadth first: visual workflows, recording, cron, webhook triggers, MCP routing, multi-agent orchestration, local LLMs, extraction, monitoring, metrics, and export.
- It feels more like an open-source automation control plane than a consumer AI browser.

## Design Tokens Observed

```yaml
visual_language:
  mode: self_hosted_developer_platform
  tone: practical_and_feature_dense
  density: high
  proof_units:
    - 25_plus_step_types
    - 50_concurrent_agents
    - 15_plus_cli_commands
    - 3_browser_engines
interaction_patterns:
  primary_action: clone_from_github
  secondary_actions:
    - read_docs
    - run_cli
    - open_dashboard
  workflow_shapes:
    - visual_builder
    - browser_recording
    - declarative_extraction
    - cron_monitoring
    - webhook_trigger
```

## Differentiators

- Vibot's design differentiator is consolidation. It claims to replace a patchwork of scripts, cron jobs, monitoring tools, and browser runners.
- The comparison table explicitly positions against Browserbase, Skyvern, Browser Use, and Playwright MCP on self-hosting, visual builder, recording, CLI, local LLMs, and data sovereignty.
- Multi-agent orchestration with up to 50 agents makes it more operationally ambitious than most local MCP browser tools.
- Built-in monitoring and Prometheus-style health checks broaden the product beyond one-off agent browsing.

## Where It Breaks Down

- The platform breadth can feel overwhelming; users may not know whether to start with the dashboard, CLI, MCP router, workflows, or agent loop.
- Running a self-hosted server at `localhost:3847` creates setup and maintenance responsibilities that a hosted browser API avoids.
- The comparison table is useful marketing, but broad checkmarks need independent reliability proof.
- Visual builders can hide failure evidence if they do not surface exact browser state, selectors, logs, screenshots, and retry decisions.

## Sources

- https://vibot.app/
- https://github.com/guytheguytheguy/computer-and-browser-automation
