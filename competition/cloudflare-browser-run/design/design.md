# Cloudflare Browser Run Design

## Look And Feel

- Browser Run is presented as a Cloudflare developer-platform primitive, not a standalone app.
- The product page uses the Cloudflare enterprise/developer visual system: short capability cards, code snippets, use-case blocks, and cross-links into Workers, AI, storage, queues, and security products.
- The docs are optimized for agents and developers, with markdown-friendly pages, clear endpoint categories, limits, pricing, and Playwright/CDP setup.
- The most distinctive design choice is trust positioning: "well-behaved bot" mode uses cryptographic signatures instead of hiding from site owners.

## Design Tokens Observed

```yaml
visual_language:
  mode: cloud_developer_platform
  tone: infrastructure_credible
  density: high
  proof_units:
    - browser_hours
    - concurrent_browsers
    - requests_per_second
    - global_network
interaction_patterns:
  primary_action: start_building
  secondary_action: view_docs
  integration_modes:
    - quick_actions
    - browser_sessions
    - Playwright
    - Puppeteer
    - CDP
    - Stagehand
trust_model:
  bot_mode: well_behaved_signed_bot
```

## Differentiators

- Cloudflare can sell browser automation as a primitive beside Workers, Durable Objects, AI Gateway, queues, storage, and security controls.
- Pricing is unusually aggressive for browser infrastructure: Workers Paid includes browser hours and low per-hour overages.
- Quick Actions make screenshots, PDFs, markdown, links, snapshots, and crawls feel like API calls rather than browser sessions.
- The compliance-friendly bot-mode story differentiates it from stealth-first scraping infrastructure.

## Where It Breaks Down

- The 60-second default inactivity timeout and concurrency/rate limits require careful session management for long autonomous tasks.
- Cloudflare's docs warn that unclosed browsers can continue consuming time until timeout, creating a billing and reliability footgun.
- "Well-behaved bot" mode may be unacceptable for buyers whose main requirement is getting through hostile anti-bot defenses.
- Browser Run is infrastructure; it does not provide a local agent workspace, visible approvals, or productized run evidence by default.

## Sources

- https://www.cloudflare.com/products/browser-rendering/
- https://developers.cloudflare.com/browser-run/
- https://developers.cloudflare.com/browser-run/pricing/
- https://developers.cloudflare.com/browser-run/limits/
