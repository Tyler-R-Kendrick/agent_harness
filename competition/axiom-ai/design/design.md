# Axiom.ai Design

## Look And Feel

- Chrome-extension-first product with a visual bot builder, dashboard, template/tutorial library, and docs organized around practical jobs like scraping, data entry, form filling, logins, and file downloads.
- The design language is approachable and instructional: short steps, many tutorials, friendly icons, and business-task language instead of low-level browser automation terminology.
- Pricing is surfaced as runtime hours and cloud-run limits, which makes the product feel closer to a utility subscription than a developer API.

## Design Tokens To Track

```yaml
surface: Chrome extension, no-code builder, docs, pricing table, run dashboard
accent: friendly no-code SaaS palette
primary_control: run bot
core_objects:
  - bot
  - step
  - runtime
  - cloud run
  - desktop run
  - webhook
  - Google Sheet
  - AI extraction step
information_density: medium
```

## Differentiators

- Packages browser automation as a Chrome-side builder rather than a chat-first agent or developer runtime.
- Makes integration primitives visible to business users: Google Sheets, webhooks, Zapier, Make, ChatGPT/LLM extraction, scheduling, and file handling.
- Uses runtime as the main pricing and dashboard object, which is easy for operators to understand even if it hides per-step variability.

## What Is Good

- The docs are workflow-oriented and help users start from common jobs rather than APIs.
- Local desktop execution plus cloud execution gives users a bridge from personal browser workflows to scheduled automation.
- Failed test runs not counting toward runtime reduces anxiety while building bots.

## Where It Breaks Down

- Visual step builders can become hard to debug when long loops hit page drift, Chrome memory pressure, or login/session changes.
- Runtime-hour pricing is understandable but still hard to forecast for slow, blocked, or retry-heavy websites.
- The extension/no-code framing does not naturally produce durable screenshots, action traces, or review artifacts at the level `agent-browser` can expose.

## Screenshot References

- Pricing tiers and runtime model: `https://axiom.ai/pricing`
- Step catalog and builder objects: `https://axiom.ai/steps`
- Documentation navigation and tutorials: `https://axiom.ai/docs/`
