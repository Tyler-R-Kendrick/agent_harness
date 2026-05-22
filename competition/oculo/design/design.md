# Oculo Design

## Look And Feel

- Oculo uses a polished AI-browser landing page with a crisp technical analogy: Cursor is to VS Code as Oculo is to Chrome.
- The visual structure is more productized than many open-source MCP tools: hero claim, platform downloads, stack badges, feature cards, FAQ, and a simple logo lockup.
- The feature language is compact and command-like, naming the 12 tools directly: `page`, `act`, `fill`, `read`, `run`, `media`, `shell`, `tabs`, `research`, `preview`, `translate`, and `lens`.
- The site leads with token-efficiency and daily-browser usability instead of only "control Chrome".

## Design Tokens Observed

```yaml
visual_language:
  mode: developer_friendly_ai_browser
  tone: precise_and_comparative
  density: medium
  trust_markers:
    - MIT license
    - no telemetry
    - local app
    - OS keychain credential storage
    - PII redaction
interaction_patterns:
  primary_actions:
    - download for macOS
    - download for Windows
    - download for Linux
    - star on GitHub
  permission_model:
    - auto
    - notify
    - confirm
    - blocked
```

## Differentiators

- The 30-token page-description claim is memorable and attacks the biggest UX cost of browser-agent loops: giant DOM or accessibility snapshots.
- The four-tier MCP permission model is more concrete than generic "privacy-first" copy.
- Built-in AI chat, reader mode, split view, tabs, bookmarks, downloads, and history position Oculo as a daily browser, not just a headless server.
- Multi-platform installers reduce the setup friction that weakens many local browser MCP tools.

## Where It Breaks Down

- The "12 MCP tools" package includes powerful actions like shell and media generation, which may make permission scope harder to explain to non-developers.
- Extremely compact page descriptions can hide important context unless the agent knows when to request deeper inspection.
- Oculo must compete with Chrome, Arc/Dia-style browsers, and browser-control MCP servers at once, which can blur whether it is a daily browser, an automation runtime, or an agent IDE.
- The site is strong on claims but light on third-party reliability evidence.

## Sources

- https://getoculo.com/
- https://github.com/xidik12/oculo
