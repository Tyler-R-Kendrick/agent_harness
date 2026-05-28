# Browserbeam Design

## Look And Feel

- Developer-docs-first product with a polished landing page, interactive pricing calculator, and dense API reference.
- The design avoids browser chrome theatrics and instead centers JSON responses, session lifecycle diagrams, step types, refs, and response fields.
- The homepage differentiates itself directly against Browserbase, Browserless, Steel, and Firecrawl.

## Design Tokens To Track

```yaml
surface: REST API docs and pricing calculator
accent: clean technical SaaS with code/JSON examples
primary_control: try free
core_objects:
  - session
  - step
  - ref
  - auto-observe
  - page diff
  - stability signal
  - credit pool
information_density: high
agent_contract:
  - structured page JSON
  - short element refs
  - changes after action
  - error plus current page state
```

## Differentiators

- Gives agents structured JSON, interactive element refs, auto-observe responses, scroll state, forms, and diffs after actions.
- Makes token reduction part of the product story by avoiding raw HTML and returning changed state.
- REST-first design means buyers do not need Playwright, Puppeteer, Chrome binaries, or WebSocket management.

## What Is Good

- The API model maps directly to agent loops: observe, act, observe changed state, repeat.
- The docs explain failure behavior and cleanup, which is crucial for avoiding runaway browser sessions.
- The pricing calculator makes cost visible before a buyer commits.

## Where It Breaks Down

- Refs are reassigned after every observation, so agent code must manage state carefully.
- REST abstraction hides the live browser details that advanced Playwright users may want.
- Credit pools spanning runtime, proxies, AI selectors, and CAPTCHA solves can still be hard to forecast during stuck workflows.

## Screenshot References

- Product and pricing: `https://browserbeam.com/`
- API reference: `https://browserbeam.com/docs`
