# BrowserCloud Design

## Look And Feel

- Simple SaaS landing page with direct feature cards, integration logos, pricing tables, and a demo CTA.
- Visual emphasis is utility: stealth browsing, CAPTCHA handling, concurrency, playground, fast startup, and live monitoring.
- Pricing design is unusually explicit, exposing credits, browser hours, scrape counts, screenshot/PDF quotas, proxy bandwidth, and concurrency.

## Design Tokens To Track

```yaml
surface: pricing-led cloud infrastructure site
accent: clean SaaS blue/green utility styling
primary_control: get started free
core_objects:
  - browser hour
  - credit
  - concurrent browser
  - proxy bandwidth
  - session recording
  - live browser monitoring
information_density: medium
pricing_model:
  - monthly credits
  - browser hours
  - proxy traffic
  - dedicated clusters
```

## Differentiators

- Leads with transparent low-entry pricing and concrete included units.
- Claims fast browser spin-up, 1,000+ simultaneous sessions, live browser monitoring, recording, stealth, proxies, and CAPTCHA handling.
- Integrates with Playwright, Puppeteer, n8n, Zapier, Make, Python, JavaScript, PHP, Java, and C#.

## What Is Good

- The pricing table is easy to compare against Browserbase-style and Browserless-style alternatives.
- The feature surface is legible for web-data teams that already know they need cloud browsers.
- Explicit credits and concurrency limits reduce some buying friction.

## Where It Breaks Down

- The design feels generic compared with more opinionated agent products.
- It says little about approvals, trace semantics, action diffs, or human review.
- Credit accounting still creates a mental model users must understand before long-running agents feel safe.

## Screenshot References

- Homepage: `https://browsercloud.io/`
- Pricing: `https://browsercloud.io/pricing`
