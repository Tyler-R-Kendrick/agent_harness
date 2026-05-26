# LumaBrowser Design

## Look and feel

- Developer-docs-first landing page with command examples above the fold.
- The interface frames the browser as an API product: REST endpoints, local ports, MCP config, WebDriver, CDP, curl/Python/Node tabs, request/response examples, and selector-fallback demos.
- The design is lighter and more documentation-oriented than many agent-browser competitors, with code examples carrying the product story.

## Approximate design tokens

```yaml
color.background: "#ffffff"
color.surface: "#f8fafc"
color.surface_code: "#0f172a"
color.text: "#0f172a"
color.text_muted: "#64748b"
color.accent_primary: "#2563eb"
color.accent_secondary: "#8b5cf6"
color.success: "#16a34a"
radius.card: "8px"
radius.button: "8px"
font.ui: "Inter/system sans-serif"
font.code: "ui-monospace/SFMono-Regular"
```

## Differentiators

- Good: the page immediately shows how to drive the browser with curl, Python, and Node, reducing setup ambiguity.
- Good: protocol breadth is clear: REST on `3000`, WebDriver on `9515`, CDP on `9222`, native MCP, and existing Selenium/Puppeteer/Playwright clients.
- Good: LLM selector fallback is framed as a reliability feature rather than generic "AI magic"; stable attributes are tried first, then model fallback.
- Breaks down: the docs-like design may undersell higher-level run review, screenshots, approvals, and evidence history.
- Breaks down: built-in fallback can hide uncertainty if the UI does not show why a selector changed and what the model chose.

## Sources

- https://lumabyte.com/
- https://lumabyte.com/apis
