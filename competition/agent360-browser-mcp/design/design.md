# Agent360 Browser MCP Design

## Look And Feel

- Marketing site is direct and demo-oriented: real Chrome, real sessions, real interventions.
- Uses a feature-grid style to make capabilities scannable: CAPTCHA solving, concurrent sessions, human-in-the-loop, provider integrations, CSP bypass, and tool count.
- Competitive comparison table is central to the design, explicitly positioning against Playwright MCP and BrowserMCP.io.

## Design Tokens To Track

```yaml
surface: marketing page, Chrome extension, local MCP server
accent: open-source developer tool with security-sensitive controls
primary_control: npx installer and Chrome Web Store install
core_objects:
  - real Chrome profile
  - color-coded tab group
  - human-in-the-loop overlay
  - CAPTCHA solver
  - provider token integration
  - MCP tool call
information_density: high
trust_posture: local-only, no telemetry, no analytics claim
```

## Differentiators

- Human-in-the-loop overlay for credentials, 2FA, and CAPTCHA-sensitive moments.
- Claims CAPTCHA solving across common challenge types.
- Ten concurrent sessions via color-coded Chrome tab groups give it a stronger session-isolation story than simple single-browser MCPs.
- Provider-specific token extraction makes it more agent-task oriented than generic browser control.

## What Is Good

- The comparison table makes buyer tradeoffs obvious.
- The feature set is concrete and tied to real browser-agent blockers: CAPTCHA, CSP, 2FA, logged-in SaaS, and concurrent sessions.
- Local-only security copy is specific: local host communication, no telemetry, and explicit permission rationale.

## Where It Breaks Down

- The feature density may increase perceived security risk because it requests broad Chrome permissions, debugger access, cookies, and all-URL access.
- CAPTCHA and token extraction are powerful but can trigger policy, compliance, and account-safety concerns for teams.
- The site is narrow around Claude Code and real Chrome, which may miss teams standardizing on managed remote browsers or CI-first testing.

## Screenshot References

- Marketing feature grid and comparison table: `https://browsermcp.dev/`
