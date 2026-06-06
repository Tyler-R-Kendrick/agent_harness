# Open Browser Use Design

## Look And Feel

- Developer-first open-source project surface: GitHub README, install commands, package badges, release links, CLI examples, MCP snippets, SDK setup, and skill-install commands.
- The product design is intentionally low chrome; it sells a local bridge, not a polished app dashboard.
- The core interaction model is "install a tool, register the native host, connect an agent runtime, and claim or control real Chrome tabs."

## Design Tokens To Track

```yaml
surface: GitHub README, CLI, Chrome extension, native host, MCP server, SDKs, agent skill
accent: open-source developer utility
primary_control: claim browser tab
core_objects:
  - Chrome tab
  - native host
  - CLI command
  - MCP server
  - SDK client
  - action plan
  - CDP command
  - task group cleanup
information_density: high
```

## Differentiators

- Pairs an MV3 extension with a local native host, letting agents operate real Chrome while keeping the transport local.
- Provides multiple integration surfaces at launch: CLI, MCP stdio, JavaScript SDK, Python SDK, Go SDK, and packaged skills for Codex and Claude Code.
- Emphasizes platform neutrality and no lock-in against hosted Browser Use-style automation.

## What Is Good

- The install story is concrete: `npm i -g open-browser-use`, setup, MCP config, and SDK packages are all visible from the README.
- It maps directly to how coding agents are used: Codex, Claude Code, Cursor, scripts, and CI can call the same local browser bridge.
- MIT licensing and small repo scope make it easy for developers to inspect, fork, and embed.

## Where It Breaks Down

- A GitHub/CLI-first surface may not satisfy users who need run history, screenshots, approvals, or team dashboards.
- Local real-profile automation raises trust questions around account scope, tab claiming, clipboard, downloads, and file chooser helpers.
- Early open-source maturity means buyers must judge connection health, extension updates, native-host install reliability, and security posture themselves.

## Screenshot References

- GitHub README and install surface: `https://github.com/iFurySt/open-browser-use`
- Product Hunt launch page: `https://www.producthunt.com/products/open-browser-use`
- MCP directory entry: `https://mcpservers.org/ko/servers/ifuryst/open-codex-browser-use`
