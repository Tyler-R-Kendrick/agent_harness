# Puppeteer Design

## Look And Feel

- Documentation-first library UX with versioned API pages, concise install commands, and executable JavaScript examples.
- The product identity is minimal and technical: code samples, API references, and troubleshooting are the design surface.
- The default mental model is "launch browser, create page, navigate, act, read state, close browser."
- Recent docs also point developers toward Puppeteer-based MCP usage through Chrome DevTools MCP and experimental WebMCP.

## Design Tokens To Track

```yaml
surface: versioned-library-documentation
accent: chrome-devtools-technical
primary_control: javascript-api-call
core_objects:
  - browser
  - page
  - locator
  - protocol
  - screenshot
  - browser-binary
  - launch-options
information_density: very-high
trust_posture: developer-owned-runtime
```

## Differentiators

- Puppeteer owns the low-level developer muscle memory for Chrome automation.
- It exposes browser actions without imposing agent abstractions, dashboards, credits, or hosted sessions.
- Its Chrome/Firefox control through DevTools Protocol and WebDriver BiDi makes it a substrate for MCP servers and agent frameworks.
- The archived reference Puppeteer MCP server shows a compact browser tool surface: navigate, screenshot, click, hover, fill, select, evaluate JavaScript, read console logs, and retrieve screenshots.

## What Is Good

- Developers can inspect and control exactly what browser code runs.
- The API is compact enough for agents to call through wrappers while remaining familiar to human developers.
- Browser binary management is integrated into installation for the full package, while `puppeteer-core` supports custom browser ownership.
- The docs stay close to runnable code instead of product metaphor.

## Where It Breaks Down

- Puppeteer does not provide run history, user approvals, trace review, or business-level workflow UX by default.
- Browser launch options, browser downloads, sandbox flags, CI dependencies, and headless/headed differences can become setup friction.
- CSS-selector and script-driven automation can be brittle against dynamic apps unless layered with better state, locator, or visual recovery.
- A raw library can be too much power for an LLM agent unless the host adds scoping, evidence capture, and network/file boundaries.

## Screenshot References

- Puppeteer docs home and install/API examples: `https://pptr.dev/`
- Archived Puppeteer MCP server README and tool list: `https://github.com/modelcontextprotocol/servers-archived/tree/main/src/puppeteer`
