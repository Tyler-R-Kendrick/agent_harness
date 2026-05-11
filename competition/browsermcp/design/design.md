# BrowserMCP Design

## Look And Feel

- Open-source developer utility centered on a GitHub README, MCP directories, and extension-based installation rather than a rich product dashboard.
- The design promise is local, fast, private, logged-in automation: the user's real Chrome profile is the product surface.
- Visual identity is sparse. The stronger design artifact is the conceptual model: AI client, local MCP server, Chrome extension, existing browser session.

## Design Tokens To Track

```yaml
surface: GitHub README, MCP directory listing, Chrome extension, local browser
accent: utility-first open-source browser automation
primary_control: install MCP server and connect extension
core_objects:
  - local MCP server
  - Chrome extension
  - existing tabs
  - logged-in profile
  - browser actions
  - screenshots
information_density: medium
trust_posture: local-first and private by default
```

## Differentiators

- Controls the user's existing Chrome rather than launching an isolated headless browser.
- Strong privacy story: activity remains local instead of being routed through a cloud browser provider.
- Logged-in sessions and real browser fingerprinting reduce friction for authenticated tasks.

## What Is Good

- The product idea is immediately legible to developers already using Claude, Cursor, Windsurf, or VS Code.
- It compresses setup into a familiar MCP-plus-extension workflow.
- The privacy and logged-in-profile story is a clear wedge against Browserbase, Browserless, and other cloud browser services.

## Where It Breaks Down

- Extension/server state creates confusing failure modes when the extension appears connected to the wrong or dead server.
- GitHub issue signals show gaps in multi-tab handling, tab persistence, looping, and video/recording expectations.
- The README notes the public repo cannot yet be built standalone because it depends on monorepo packages, which weakens open-source trust.
- It is a tool surface, not a full inspectable agent workspace with durable traces, eval artifacts, approvals, and run history.

## Screenshot References

- GitHub README and repository chrome: `https://github.com/BrowserMCP/mcp`
- MCP directory card and tool taxonomy: `https://mcp.directory/mcp/details/699/browser`
