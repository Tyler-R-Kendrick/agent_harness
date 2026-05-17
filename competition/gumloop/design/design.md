# Gumloop Design

## Look And Feel

- Canvas-first automation builder with nodes, flows, agents, and integration steps as the dominant interface.
- The design reads as AI-native no-code tooling: users assemble steps visually, then let agents call tools or workflows from inside the same platform.
- Documentation screenshots emphasize agent tool configuration, web search/fetch providers, model choices, and credit cost visibility.

## Design Tokens To Track

```yaml
surface: visual workflow canvas plus agent configuration panels
accent: bright product color on a light SaaS workspace
primary_control: drag-and-drop nodes and natural-language agent instructions
secondary_controls:
  - tool selection
  - workflow triggers
  - model and provider selection
  - credit usage views
  - BYOK configuration
trust_controls:
  - grouped and detailed credit breakdowns
  - tool limiting
  - team credentials and access controls
information_density: high
```

## Differentiators

- Gumloop makes AI the default logic layer instead of a late add-on node.
- The product blends standalone agents with workflow-embedded agent nodes, so teams can move from chat-style delegation into repeatable scheduled or webhook-triggered automation.
- Credit docs expose cost drivers directly, including model tier, conversation length, tools called, workflow calls, loops, enrichment nodes, and BYOK discounts.

## What Is Good

- Strong fit for operators who want to automate research, enrichment, content, CRM, and internal process work without coding.
- Agent tools, web fetch/search, workflows, and app integrations live in one build surface.
- Cost guidance is unusually explicit for an AI automation product, which helps teams reason about runaway loops and enrichment-heavy flows.

## Where It Breaks Down

- The canvas can be easier to operate than to audit when a web task fails because the browser state is abstracted behind nodes and fetch providers.
- Credit-based pricing can become hard to predict once agents call workflows, models, and external data tools dynamically.
- Browser-specific problems such as authenticated sessions, CAPTCHA, visual page state, and exact click evidence are less central than in a browser-first workbench.

## Screenshot References

- Product docs and screenshots: `https://docs.gumloop.com/`
- Agent configuration docs: `https://docs.gumloop.com/core-concepts/agents`
- Credit usage docs: `https://docs.gumloop.com/core-concepts/credits`
