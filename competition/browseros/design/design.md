# BrowserOS Design

## Look And Feel

- Developer/AI-native landing page with high-contrast dark sections, big capability counters, video/demo panels, and "Browse. Automate. Build." messaging.
- Product interface is framed as a browser plus embedded agent, split view AI, MCP tools, scheduled automation, and terminal/CLI integration.
- Design leans technical but tries to stay consumer-installable: "No terminal. No setup. Privacy-first."

## Design Tokens To Track

```yaml
surface: dark technical marketing with bright accent panels
accent: green/blue terminal-like AI readiness cues
primary_control: natural-language agent prompt inside browser
secondary_controls:
  - split-view model panel
  - MCP integrations
  - scheduled tasks
  - CLI/MCP server
trust_controls:
  - open source
  - local or BYOK models
  - sandboxed agent
information_density: high
```

## Differentiators

- Open source is central, not incidental.
- Supports multiple AI providers and local models.
- MCP/app integrations and CLI control make it a bridge between consumer browser and developer automation surface.

## What Is Good

- Privacy-first positioning directly attacks the weakest perception of Atlas/Comet/Dia.
- Cross-platform support is broader than many consumer AI browsers.
- MCP and CLI integration make it credible for agents like Codex, Claude Code, and Gemini CLI.

## Where It Breaks Down

- The feature surface is broad enough to feel intimidating.
- Open-source/privacy claims still require users to understand model-provider data paths.
- A Chromium fork plus agent platform can create maintenance and crash risk.

## Screenshot References

- Official product page and demo videos: `https://browseros.com/`
- GitHub README screenshots/architecture: `https://github.com/browseros-ai/BrowserOS`

