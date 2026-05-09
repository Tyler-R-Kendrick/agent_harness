# Kernel Design

## Look And Feel

- Documentation-led infrastructure product with simple conceptual framing: create a browser, connect over CDP, run the automation, inspect the session.
- Pricing is unusually explicit for the category, showing per-second headless/headful rates, plan gates, concurrency limits, replay retention, and idle browser-pool disk costs.
- Integration pages are adapter-like and concise, including a dedicated `agent-browser` provider guide.

## Design Tokens To Track

```yaml
surface: docs, CLI, SDK, dashboard, live view, replays
accent: minimal infrastructure documentation
primary_control: kernel.browsers.create
core_objects:
  - browser
  - invocation
  - profile
  - managed auth connection
  - replay
  - live view
  - browser pool
  - standby mode
information_density: high
```

## Differentiators

- Direct `agent-browser` integration reduces friction for users already using this repo's ecosystem.
- Standby mode and per-second pricing are positioned as cost controls against browser-hour minimums.
- Browser profiles, managed auth, replays, live view, stealth, pools, and CLI process control create a broad production checklist.

## What Is Good

- The pricing table is clear enough for engineering planning and procurement discussion.
- CDP-first design lets teams keep Playwright/Puppeteer logic while outsourcing browser lifecycle.
- Replays and live view support human-in-the-loop debugging without turning the whole product into an end-user browser.

## Where It Breaks Down

- Important capabilities are tier-gated: profiles, managed auth, file upload/download, extensions, BYO proxies, and browser pools require paid tiers.
- Users still need to build or bring the agent loop, verification, and UI around the browser primitive.
- Browser pools introduce idle disk costs that can surprise teams expecting pure usage billing.

## Screenshot References

- Intro docs: `https://www.kernel.sh/docs`
- Pricing and limits: `https://www.kernel.sh/docs/info/pricing`
- Agent Browser integration: `https://www.kernel.sh/docs/integrations/agent-browser`
