# Magnitude Design

## Look And Feel

- Developer-docs-first product with a concise homepage, Mintlify documentation, code-first examples, and a strong "vision-first" technical identity.
- The primary interface is not a browser shell. It is a TypeScript API around `startBrowserAgent`, `act`, `nav`, `extract`, browser options, and test-runner concepts.
- The docs use short examples and method-level pages rather than large conceptual diagrams, which makes the product feel lightweight and easy to try.

## Design Tokens To Track

```yaml
surface: developer documentation and open-source SDK
accent: minimal technical landing page with code blocks
primary_control: npx create-magnitude-app
core_objects:
  - browser agent
  - act step
  - navigation
  - screenshot context
  - action history
  - zod schema
  - Playwright page and context
  - test case agent
information_density: medium
agent_contract:
  - natural-language action
  - structured extraction schema
  - configurable LLM provider
  - configurable browser launch/context/CDP connection
```

## Differentiators

- Magnitude leads with vision-first action selection rather than DOM selectors, accessibility snapshots, or hosted browser infrastructure.
- The API keeps regular developer control nearby: direct navigation, Playwright `Page`/`BrowserContext` access, launch options, context options, CDP connection, and Zod-based extraction.
- The positioning claims high WebVoyager performance and "reliable, fast, deterministic" automation while still letting users customize the model and browser.

## What Is Good

- The mental model is simple: start an agent, navigate, act, extract, stop.
- Zod extraction gives developers a typed output contract instead of loose page summaries.
- Playwright escape hatches make it easier to combine deterministic steps with AI steps.
- The docs explain what the agent can see: screenshots, some past screenshots, action history, active tab, and open tabs.

## Where It Breaks Down

- A vision-first API can be slower and harder to debug than deterministic selectors when a UI is stable.
- The documentation is thinner than larger hosted platforms around governance, replay, approvals, team sharing, and production incident handling.
- The product story is developer-centric; end users looking for a visible workspace, manual handoff, or durable run evidence will not get that as the primary surface.

## Screenshot References

- Homepage and positioning: `https://magnitude.run/`
- BrowserAgent reference: `https://docs.magnitude.run/reference/browser-agent`
- Browser interaction docs: `https://docs.magnitude.run/core-concepts/browser-interaction`
