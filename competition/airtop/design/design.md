# Airtop Design

## Look And Feel

- Operator-friendly SaaS surface that combines developer docs, pricing tables, automation galleries, and business workflow examples.
- The marketing site is brighter and more app-store-like than most browser-infra competitors: categories, templates, testimonials, and "select plan" calls to action are prominent.
- Docs present the product as a simple cloud browser abstraction first, then layer AI APIs, Playwright/Puppeteer/Selenium, authentication, proxies, and scraping.

## Design Tokens To Track

```yaml
surface: SaaS marketing, developer docs, automation catalog, developer portal
accent: high-contrast business automation palette
primary_control: create cloud browser session
core_objects:
  - browser session
  - published agent
  - shared auth
  - live view
  - AI API operation
  - credit usage
  - proxy
information_density: medium
```

## Differentiators

- Bridges developer APIs and no-code business automation by showing packaged automations for roles like sales, HR, marketing, finance, research, and software development.
- Shared auth, embedded live view, audio, and scraping are marketed together, so the design points at "agents operating on behalf of users" rather than just browser hosting.
- Pricing exposes business-friendly constraints such as simultaneous sessions and published agents instead of only low-level CPU or browser-hour units.

## What Is Good

- The automation catalog helps non-infra buyers see concrete use cases quickly.
- Cost controls are explicit in docs: AI API responses expose credit usage and support time or credit thresholds.
- The docs keep a pragmatic bridge to existing automation stacks by supporting Playwright, Puppeteer, and Selenium.

## Where It Breaks Down

- The mix of templates, sessions, credits, agents, proxies, and AI-token costs can make total cost harder to forecast than a simple local runtime.
- Business-friendly packaging may hide the deterministic debugging detail that engineers need when a browser action misfires.
- The catalog framing can bias users toward natural-language agents even when a cheaper deterministic script would be more reliable.

## Screenshot References

- Pricing and plan structure: `https://www.airtop.ai/pricing`
- Automation catalog: `https://www.airtop.ai/automations`
- Developer docs: `https://docs.airtop.ai/`
