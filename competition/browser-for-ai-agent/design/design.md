# Browser for AI Agent Design

## Look And Feel

- GitHub README is the main surface, with a plain open-source extension posture rather than a polished SaaS site.
- The product is framed around capabilities and warnings: read tab data, control browser, execute page scripts, and trust only safe agents/toolsets.
- Installation is release-driven because Chrome Web Store and Firefox Add-ons approval is pending in the snapshot.

## Design Tokens To Track

```yaml
surface: browser extension plus native messaging host
primary_control: local MCP host and extension settings
core_objects:
  - browser tab
  - tab metadata
  - page content
  - cookies
  - localStorage
  - page errors
  - screenshots
  - page tools
  - WebMCP tools
privacy_boundary: local native host plus user-configured agent
information_density: high
trust_posture: explicit prompt-injection and tool trust warnings
```

## Differentiators

- It exposes more than visual/page control: cookies, localStorage, errors, and toolset configuration are part of the agent-readable surface.
- Page tools can come from subscribed toolsets or developer-provided WebMCP APIs, making the browser a bridge between page-native tools and external agents.
- The README places security warnings near the core feature description instead of hiding them.

## What Is Good

- Honest security framing acknowledges prompt injection and malicious page-tool risk.
- Extension plus native host keeps browser data local by default.
- WebMCP support points toward a more structured future than raw DOM/script automation.

## Where It Breaks Down

- Store listings pending means installation is still a developer/release workflow.
- Cookie and localStorage access are powerful but risky primitives.
- Toolsets and page-provided tools need clear provenance, review, and permission boundaries.

## Screenshot References

- README and release install flow: `https://github.com/mantou132/browser4agent`
- Reddit launch preview: `https://www.reddit.com/r/mcp/comments/1toe13v/i_built_a_browser_extension_that_lets_claude_and/`
