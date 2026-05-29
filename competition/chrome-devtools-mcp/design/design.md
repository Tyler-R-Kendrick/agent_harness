# Chrome DevTools MCP Design

## Look And Feel

- GitHub README is the primary product surface: official branding, install snippets, client-specific setup, and extensive compatibility sections.
- The design inherits Chrome DevTools credibility rather than a bespoke SaaS dashboard.
- It frames the browser as an inspectable debugging target, not merely a click automation surface.

## Design Tokens To Track

```yaml
surface: GitHub README plus npm MCP server
primary_control: npx chrome-devtools-mcp
core_objects:
  - live Chrome browser
  - DevTools target
  - MCP server
  - CLI
  - plugin
  - skills
  - performance analysis
agent_clients:
  - Antigravity
  - Claude Code
  - Copilot
  - VS Code
  - Cursor
  - Gemini CLI
information_density: very_high
trust_posture: official Chrome/DevTools lineage
```

## Differentiators

- It carries official Chrome DevTools authority, which is hard for smaller browser-agent vendors to match.
- The setup surface enumerates many agent clients, making broad compatibility feel default.
- It can inspect browser internals, debug, and analyze performance, not only navigate and click.

## What Is Good

- One-command `npx` installation makes trial low-friction for developers.
- The `--slim` mode acknowledges tool/context overhead.
- DevTools depth is valuable for coding agents fixing web apps, not just browsing public pages.

## Where It Breaks Down

- README-heavy UX is excellent for developers but not an end-user browser workspace.
- DevTools power can overwhelm agents unless skills and slim profiles constrain behavior.
- It does not inherently solve product-level run history, approvals, cost tracking, or durable workflow evidence.

## Screenshot References

- GitHub README and install sections: `https://github.com/ChromeDevTools/chrome-devtools-mcp`
