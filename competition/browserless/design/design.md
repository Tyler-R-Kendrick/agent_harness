# Browserless Design

## Look And Feel

- Developer-infrastructure site with strong split between BrowserQL, BaaS, REST APIs, AI integrations, and enterprise deployment.
- The public site leads with live automation/unblocker framing, product tiles, pricing cards, and API connection examples.
- Documentation is broad and task-oriented: quickstart, BrowserQL, BaaS, REST, Docker, AI integrations, OpenAPI, and BrowserQL schema.

## Design Tokens To Track

```yaml
surface: docs, hosted dashboard, BrowserQL IDE, session replay, pricing grid
accent: automation blue and infrastructure dark UI
primary_control: connect to a managed browser or run a BrowserQL mutation
core_objects:
  - browser session
  - BrowserQL query
  - WebSocket endpoint
  - REST task
  - replay
  - log
  - proxy
  - CAPTCHA solve
information_density: high
```

## Differentiators

- BrowserQL is a branded GraphQL-style automation layer built around stealth, humanized interactions, CAPTCHA handling, and session reuse.
- BaaS preserves existing Puppeteer/Playwright investment through a remote WebSocket endpoint.
- Session replay records DOM mutation, clicks, scrolling, keyboard input, console logs, and network requests, which turns failed automations into reviewable evidence.

## What Is Good

- Clear product segmentation reduces buyer confusion: declarative BrowserQL for blocked sites, BaaS for existing code, REST for one-shot tasks.
- Pricing makes concurrency, session duration, log retention, and replay retention explicit enough for teams to estimate production usage.
- Debugging and evidence surfaces are strong: dashboard logs, screen recording, session replay, and live browser views all map to real operator pain.

## Where It Breaks Down

- The surface area is large: BrowserQL, BaaS, REST, Docker, Playwright/Puppeteer compatibility, AI integrations, proxies, CAPTCHA, and private deployments create many configuration paths.
- BrowserQL may become a second automation language that teams must learn even if they already have Playwright skills.
- Unit-based pricing, proxy bandwidth, CAPTCHA solves, and session reconnects can make cost harder to reason about than local browser execution.

## Screenshot References

- Landing/product: `https://www.browserless.io/`
- BrowserQL product page: `https://www.browserless.io/feature/browserql`
- Documentation index: `https://docs.browserless.io/`
- Pricing grid: `https://www.browserless.io/pricing`
