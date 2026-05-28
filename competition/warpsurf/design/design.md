# Warpsurf Design

## Look And Feel

- Lightweight open-source browser-copilot site with a direct hero, demo media, feature grids, and strong local/privacy language.
- Product surface is Chrome-extension-native: side panel, context menus, tab previews, agent manager, trajectory view, and workflow graph.
- The design emphasizes speed and control rather than enterprise governance.

## Design Tokens To Track

```yaml
surface: Chrome extension, side panel, agent manager, workflow graph, trajectory view
primary_objects:
  - workflow
  - query
  - autonomous_agent
  - tab_context
  - history_context
  - workflow_graph
  - trajectory
  - cost_estimate
  - URL_firewall_rule
core_controls:
  - chat
  - search
  - deploy agent
  - voice input
  - pause
  - resume with instructions
  - live follow-up
  - emergency stop
trust_controls:
  - BYO API keys
  - local browser execution
  - URL firewall allow/deny
  - capped keys recommendation
  - real-time monitoring
```

## Differentiators

- Smart routing between chat, search, and agent workflows reduces the mode-choice burden.
- Multi-agent orchestration and workflow DAGs make parallel research and status visible.
- Cost design is unusually explicit: real-time token/cost stats, task estimation, and live provider pricing.
- Control design is strong for a small tool: pause/resume, live follow-up, emergency stop, and hand-back at critical junctures.

## What Is Good

- Warpsurf validates that users want a local browser copilot inside the browser they already use.
- The URL firewall is a concrete answer to agent authority boundaries.
- Trajectory and workflow graph surfaces align with `agent-browser`'s evidence-first direction.

## Where It Breaks Down

- The site calls the project active research and warns that browser automation carries inherent risks.
- BYO keys and local execution reduce platform custody, but push model-cost, key-scoping, and safety configuration onto users.
- The open-source extension story may lack managed enterprise controls, durable evals, and support expectations.

## Screenshot And Design Studio References

- Product demos and feature grid: https://warpsurf.ai/
- Chrome extension listing: https://chromewebstore.google.com/detail/warpsurf/ekmohjijmhcdpgficcolmennloeljhod
- Source repository: https://github.com/warpsurf/warpsurf
