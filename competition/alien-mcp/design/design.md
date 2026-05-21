# AlienMcp Design

## Look And Feel

- The website is a single-page developer landing page with a light, simple structure and a prominent command-demo panel.
- It leads with a clear mental model: AI agent -> MCP server -> Chrome extension -> CDP -> real browser.
- Feature cards are plain and practical: real browser, tab group scoping, trusted events, MCP standard, local-only operation, and 19 tools.
- The install flow is explicit but developer-heavy, requiring clone/build steps for both the extension and MCP server.

## Design Tokens Observed

```yaml
visual_language:
  mode: lightweight developer landing page
  surfaces: hero demo block, feature cards, tool grid, architecture flow, numbered setup steps
  information_density: medium
  trust_language: local, no analytics, no tracking, scoped tabs
interaction_patterns:
  primary_actions:
    - get started
    - view on GitHub
  setup_steps:
    - build Chrome extension
    - build MCP server
    - register with Claude Code
    - add tabs to AlienMcp group
```

## Differentiators

- Tab Group Scoping is the clearest design win. It gives the user a visible browser-native boundary for what the agent can see.
- The architecture diagram is compact and easy to understand, which lowers trust friction compared with broader automation platforms.
- Trusted CDP events are positioned well for sites that reject synthetic JavaScript events.
- The tool list covers practical debugging and automation needs, including network, console, cookies, storage, PDF, DOM reads, and JS execution.

## Where It Breaks Down

- Manual build/load steps make onboarding heavier than Chrome Web Store extension products.
- The UI does not yet show a rich approval, replay, or audit layer, so it may be harder to prove what happened after a run.
- CDP and JavaScript execution power are useful but sensitive; non-expert users may not understand the authority they are granting.
- The product page is concise, but deeper docs, screenshots, and failure examples are limited in the public surface.

## Sources

- https://www.alien-mcp.com/
- https://github.com/YasserLoukniti/AlienMcp
