# Reapre Design

## Look and feel

- Dark SaaS control-plane aesthetic: black/near-black page, compact neon-accent cards, terminal-like command snippets, small metric tiles, and dashboard-oriented labels such as `LOG`, `WSS`, `CFG`, and `OPS`.
- The marketing page visualizes architecture first: AI agent, API surfaces, Reapre Cloud, browser/computer/mobile/apps layers, command counts, recordings, approvals, and webhooks.
- Product copy leans heavily on numbers: 1088 commands, 72 tools, 4 execution layers, 27 app connectors, request quotas, and API key counts.

## Approximate design tokens

```yaml
color.background: "#05060a"
color.surface: "#10131a"
color.surface_muted: "#171b24"
color.text: "#f5f7fb"
color.text_muted: "#9ca3af"
color.accent_primary: "#7c3aed"
color.accent_secondary: "#22d3ee"
color.success: "#22c55e"
radius.card: "12px"
radius.button: "999px"
font.ui: "Inter/system sans-serif"
font.code: "ui-monospace/SFMono-Regular"
```

## Differentiators

- Good: the design makes breadth legible by grouping the product into execution layers, protocols, governance, and pricing. That helps buyers understand that browser automation is only one part of the platform.
- Good: replay, approvals, network logs, and webhook delivery history are visible in the information architecture, which strengthens the trust story for powerful automation.
- Breaks down: the same numeric breadth can feel like tool sprawl. A browser-agent user looking for one inspectable run may have to mentally filter through desktop, Android, app connector, OAuth, and billing concepts.
- Breaks down: the page is command-surface heavy and screenshot-light; it explains capabilities better than it proves what a debugging session actually looks like.

## Sources

- https://reapre.io/
