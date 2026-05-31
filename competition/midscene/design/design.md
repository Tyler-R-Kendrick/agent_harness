# Midscene.js Design

## Look And Feel

- Polished open-source developer product with a modern website, GitHub README, rich showcases, and visual automation demos.
- The product design is more expansive than browser-only libraries: web, Android, iOS, desktop, canvas, bridge mode, MCP, Chrome extension, and report tooling all share the same brand.
- The docs emphasize APIs and tools rather than a managed cloud: PlaywrightAgent, PuppeteerAgent, YAML scripts, Chrome extension, playgrounds, and replay report files.

## Design Tokens To Track

```yaml
surface: open-source website, docs, GitHub, Chrome extension, replay reports
accent: vision-driven multi-platform automation
primary_control: SDK or YAML automation script
core_objects:
  - PlaywrightAgent
  - PuppeteerAgent
  - aiAction
  - aiQuery
  - aiAssert
  - aiLocate
  - aiWaitFor
  - bridge mode
  - MCP tool
  - replay report
  - cache
information_density: high
agent_contract:
  - screenshot-first action localization
  - optional DOM for extraction and page understanding
  - atomic Midscene actions exposed to upper-layer agents
```

## Differentiators

- Midscene is explicit about pure-vision localization for UI actions, with DOM still optional for extraction and page understanding.
- Cross-platform coverage is unusually broad: web, mobile, desktop, canvas, iframes, and custom interfaces.
- Debugging and adoption surfaces are first-class: replay reports, built-in playgrounds, a Chrome extension, MCP services, and caching.

## What Is Good

- The product understands that developer trust comes from replayable evidence, not only successful action completion.
- The API fits both test automation and agent-tool use: action, extraction, assertion, location, waiting, and MCP exposure.
- Bridge mode and Chrome extension paths lower the barrier for testing real desktop-browser flows.

## Where It Breaks Down

- Pure-vision action loops still pay model-call latency per step unless cache applies.
- Debugging model intent is a different workflow than inspecting selector failures.
- The breadth of web/mobile/desktop/MCP/playground/extension surfaces can make the product harder to evaluate for a narrow browser-agent use case.
- QA users with stable DOM, test IDs, and mature Playwright patterns may see AI locators as unnecessary risk.

## Screenshot References

- Homepage and showcases: `https://midscenejs.com/`
- GitHub README and design claims: `https://github.com/web-infra-dev/midscene`
- Web API reference: `https://midscenejs.com/web-api-reference`
