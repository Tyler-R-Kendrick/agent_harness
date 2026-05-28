# BrowserCat Design

## Look And Feel

- BrowserCat uses a playful developer-infrastructure landing page with a visible product demo, mascot imagery, testimonial blocks, pricing controls, and documentation links.
- The visual system is intentionally lighter than enterprise browser-cloud products: rounded sections, friendly copy, and approachable pricing sit next to code snippets and protocol names.
- The docs are practical and code-first, with a persistent left navigation for Playwright, Puppeteer, CDP clients, browser configuration, and use cases.
- The pricing page uses a credit slider and plain explanations for websocket duration versus utility API requests.

## Design Tokens Observed

```yaml
visual_language:
  mode: playful_developer_infrastructure
  tone: friendly_and_low_friction
  density: medium
  proof_units:
    - supported_protocols
    - global_browser_fleet
    - credits_per_month
    - concurrent_requests
interaction_patterns:
  primary_action: start_free
  secondary_action: view_docs
  pricing_unit: credits
  protocols:
    - Playwright
    - Puppeteer
    - CDP
```

## Differentiators

- The design makes hosted browsers feel approachable for small teams, not only large scraping operations.
- It is explicit about open automation protocols, which reduces migration fear for Playwright-heavy teams.
- Cost controls are unusually visible: free credits, per-credit overages, soft limits, and hard limits are explained in user-facing pricing copy.
- The mascot and informal language make the product memorable in a category full of dark dashboards and generic cloud API pages.

## Where It Breaks Down

- The playful style can under-signal enterprise trust, compliance, and abuse-boundary detail for teams handling sensitive logged-in workflows.
- AI-agent support is framed as one use case among scraping, PDFs, tests, and media generation rather than a dedicated agent workbench.
- The page claims broad automation freedom, but agent-browser buyers still need evidence controls, permission boundaries, and post-run replay surfaces that are not the core homepage story.
- Browser fleet abstraction removes local setup pain but moves credential, proxy, bot-detection, and data-retention questions into vendor trust.

## Sources

- https://www.browsercat.com/
- https://www.browsercat.com/docs
- https://www.browsercat.com/pricing
