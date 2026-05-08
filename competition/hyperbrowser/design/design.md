# Hyperbrowser Design

## Look And Feel

- Developer infrastructure design: docs-first, API-first, and organized around quickstart cards for sessions, scraping, agents, SDKs, and integrations.
- The marketing surface uses speed, scale, and reliability language rather than consumer productivity language.
- HyperAgent's design is code-native: Playwright-shaped APIs such as granular actions, extraction, task execution, regular Playwright fallback, and cloud provider switching.

## Design Tokens To Track

```yaml
surface: developer docs, cloud dashboard, open-source SDK
accent: fast cloud browsers for AI agents
primary_control: create session, connect CDP, run agent, scrape/fetch/search
core_objects:
  - browser session
  - scrape
  - crawl
  - fetch
  - search
  - HyperAgent task
  - Browser Use agent task
  - session recording
  - MCP server
pricing_units:
  - credits
  - browser hours
  - proxy GB
  - pages
  - agent steps
information_density: high
```

## Differentiators

- Hyperbrowser combines browser infrastructure, web APIs, and several agent execution modes rather than betting on one agent framework.
- HyperAgent extends Playwright with AI methods and preserves fallback to normal Playwright when deterministic code is better.
- Pricing is unusually granular and transparent for infrastructure buyers: browser hours, proxy data, fetch/search/scrape pages, model tokens, and agent steps.
- MCP and framework integrations make it attractive as a neutral browser substrate for AI-agent stacks.

## What Is Good

- The docs make the infrastructure boundary clear: use Playwright, Puppeteer, Selenium, SDKs, scraping endpoints, or agent APIs depending on the task.
- The product acknowledges that not every browser action should be AI-driven; this supports cheaper and more reliable hybrid workflows.
- Session recordings and dashboard task views give teams post-run debugging evidence.

## Where It Breaks Down

- The broad surface can be hard to reason about: Hyperbrowser, HyperAgent, Browser Use hosting, model-native CUA, scraping APIs, and MCP all overlap.
- Usage-based pricing is transparent but still cognitively heavy because tasks can combine browser time, proxy data, step costs, and model-token costs.
- Hosted-infrastructure positioning may miss users who want the agent's reasoning, browser state, and artifacts to stay local.

## Screenshot And Open Design References

- Product docs home and feature cards: https://www.hyperbrowser.ai/docs/introduction
- Agent overview: https://www.hyperbrowser.ai/docs/agents/overview
- HyperAgent repository and README examples: https://github.com/hyperbrowserai/HyperAgent
