# SurfAgent Design

## Look and feel

- Dark, direct-response product page with terse engineering claims: local, persistent, CDP-native, isolated, no subscription, and no data leaves the device.
- The visual language is a dedicated browser appliance: status badges, comparison tables, setup steps, daemon ports, API snippets, and pricing math against cloud browsers.
- The first impression is practical rather than decorative: a second Chrome for agents, localhost ports, `npx surfagent-mcp`, and $49 lifetime pricing.

## Approximate design tokens

```yaml
color.background: "#050505"
color.surface: "#111111"
color.surface_alt: "#18181b"
color.text: "#f8fafc"
color.text_muted: "#a1a1aa"
color.accent_primary: "#22c55e"
color.accent_secondary: "#38bdf8"
color.warning: "#f59e0b"
radius.card: "10px"
radius.badge: "999px"
font.ui: "Inter/system sans-serif"
font.code: "ui-monospace/SFMono-Regular"
```

## Differentiators

- Good: the design is unusually clear about deployment boundaries: local Windows app, dedicated Chrome profile, localhost CDP on `9222`, daemon API on `7201`, and MCP via `npx surfagent-mcp`.
- Good: the comparison table makes the product's wedge easy to scan: local, isolated, persistent cookies, full CDP, no monthly cost, and crash recovery.
- Good: the page turns runtime reliability into product UX with health checks, automatic restart, session persistence, screenshots, extraction, crawl, and map.
- Breaks down: the page leans into bot-detection bypass and unattended automation claims, which can make trust and abuse boundaries feel under-specified.
- Breaks down: tokenomics content sits beside a browser-infrastructure pitch and may distract enterprise buyers from the local security story.

## Sources

- https://surfagent.app/
- https://clawhub.ai/agentossoftware/surfagent
