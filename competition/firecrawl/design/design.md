# Firecrawl Design

## Look And Feel

- Developer-first API product with a clean, high-contrast marketing surface and docs organized around endpoints, SDKs, CLI, MCP, and browser sessions.
- The visual language sells "messy web to clean context" more than a browser workspace: cards, endpoint names, examples, and pricing/credit tables do most of the work.
- Browser control is presented as infrastructure, not as a human-facing browser cockpit.

## Design Tokens To Track

```yaml
surface: marketing site, docs, hosted dashboard, CLI, MCP server
primary_objects:
  - search result
  - scrape response
  - crawl job
  - browser session
  - interact action
  - schema extraction
  - MCP tool call
core_outputs:
  - markdown
  - structured_json
  - screenshot
  - metadata
  - raw_html
  - live_browser_stream
trust_controls:
  - robots_txt_firecrawlagent_directive
  - API keys
  - credit accounting
  - self-hosting option
  - hosted browser sandbox
```

## Differentiators

- It collapses search, scraping, crawling, structured extraction, MCP, CLI, and hosted browser sessions into one agent data layer.
- The product gives agents "clean context" as the main design metaphor, which is easier to buy than a full autonomous browsing UI.
- The agent onboarding skill is a strong distribution design move because it lets coding agents guide signup and configuration directly.

## What Is Good

- The endpoint taxonomy is simple: search to find, scrape to read, crawl to cover a site, interact/browser when the page requires actions.
- Markdown and schema-shaped JSON align with how LLM applications actually consume web data.
- Browser sessions include a clear price unit, which makes cost easier to reason about than opaque agent time.

## Where It Breaks Down

- The hosted product is stronger than the self-hosted product for browser and agent endpoints, which can surprise buyers expecting open-source parity.
- Turning web pages into clean context can hide uncertainty unless screenshots, source URLs, and extraction confidence are preserved.
- It is not a local browser assistant; authenticated personal workflows still need credential and authority design outside Firecrawl.

## Screenshot And Design Studio References

- Marketing and positioning: https://www.firecrawl.dev/
- Browser sessions docs: https://docs.firecrawl.dev/features/browser
- Agent/MCP onboarding: https://docs.firecrawl.dev/ai-onboarding
