# Apify Design

## Look And Feel

- Marketplace-first SaaS design with search, categories, ratings, usage counts, Actor cards, pricing labels, and run/configure surfaces.
- Documentation is platform-oriented and modular: Actors, Store, storage, MCP, integrations, billing, publishing, and monetization.
- AI-agent pages emphasize browsing tools, agent marketplace, MCP configuration, and structured web data for LLMs.

## Design Tokens To Track

```yaml
surface: marketplace, console, docs, Actor detail page, MCP configurator
accent: marketplace cards and developer console patterns
primary_control: choose an Actor and run it with structured JSON input
core_objects:
  - Actor
  - task
  - run
  - dataset
  - key-value store
  - request queue
  - proxy
  - MCP tool
  - Store listing
information_density: high
```

## Differentiators

- Actor marketplace gives Apify breadth that browser-agent products cannot easily match: thousands of prebuilt scrapers and automations for named sites and jobs.
- MCP turns Actors into discoverable agent tools, moving Apify from scraping platform to agent tool distribution layer.
- Built-in publishing and monetization creates a two-sided market for automation creators.

## What Is Good

- Strong object model: Actor input, run logs, datasets, schedules, APIs, and Store listings are understandable to technical buyers.
- Ratings, usage counts, issue tabs, source links, and maintenance labels make individual automation quality more inspectable than a generic browser agent.
- Structured outputs reduce token waste for agents that need data rather than a full browser trace.

## Where It Breaks Down

- Marketplace breadth creates quality variance; each Actor can have different maintenance, pricing, input shape, output quality, and support responsiveness.
- The console/Actor model is less natural for interactive, multi-step human-in-the-loop browsing.
- Cost can be difficult to forecast because platform compute, Store Actor pricing, storage, proxy, and data-transfer charges can combine.

## Screenshot References

- Store: `https://apify.com/store`
- AI agents landing: `https://apify.com/ai-agents`
- AI agent marketplace: `https://apify.com/ai-agents/ai-agent-marketplace`
- AI Web Agent listing: `https://apify.com/apify/ai-web-agent`
- Pricing: `https://apify.com/pricing/`
