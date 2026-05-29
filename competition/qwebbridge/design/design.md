# QWebBridge Design

## Look And Feel

- Landing page is a compact technical explainer with a visible flow diagram: AI agent, skill, daemon, extension, CDP, real browser.
- Design is protocol-first rather than brand-heavy; the main affordances are setup steps, tool count, local ports, and compatibility claims.
- The docs emphasize local control and privacy more than visual polish.

## Design Tokens To Track

```yaml
surface: local daemon plus Chrome extension
primary_control: CLI and MCP/WebSocket/HTTP endpoints
core_objects:
  - agent skill
  - local daemon
  - Chrome extension
  - real tabs
  - screenshots
  - sessions
  - troubleshooting commands
protocols:
  - WebSocket
  - MCP
  - HTTP REST
  - Chrome DevTools Protocol
default_port: 10086
information_density: high
trust_posture: localhost-only and self-hosted
```

## Differentiators

- It explicitly reimplements Kimi WebBridge compatibility while adding MCP, HTTP, CLI, and a reusable `SKILL.md`.
- The product teaches agents how to use the bridge through an installable skill, not only through MCP tool descriptions.
- The architecture diagram makes the data path understandable in one glance.

## What Is Good

- Clear local trust model: daemon and extension communicate over localhost.
- Supports multiple agent clients without requiring a managed cloud browser.
- Skill-based usage guidance can reduce bad tool calls and setup confusion.

## Where It Breaks Down

- Requires daemon, extension, skill, and agent configuration to all line up.
- Extension/CDP control over real logged-in tabs needs stronger consent and scoping UX than a generic local-port claim.
- Compatibility with Kimi WebBridge is useful for adopters but may confuse users who do not know that ecosystem.

## Screenshot References

- Architecture and setup flow: `https://qweb-bridge.huqi.host/`
