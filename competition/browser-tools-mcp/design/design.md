# BrowserTools MCP Design

## Look And Feel

- GitHub README and docs-first product surface, with setup commands, architecture diagrams, and tool examples carrying most of the UX.
- The product feels like a developer debugging bridge rather than a standalone browser-agent application.
- The core mental model is three pieces: Chrome extension, local Node server, and MCP server.
- The design emphasizes local data flow and IDE integration over polished product chrome.

## Design Tokens To Track

```yaml
surface: github-readme-and-local-devtools-panel
accent: pragmatic-open-source-debugging
primary_control: npx-install-and-devtools-panel
core_objects:
  - chrome-extension
  - browser-tools-server
  - mcp-server
  - console-log
  - network-request
  - screenshot
  - selected-element
  - lighthouse-audit
information_density: high
trust_posture: local-first-but-extension-mediated
```

## Differentiators

- BrowserTools MCP captures the exact browser artifacts coding agents need when fixing UI bugs: console logs, network activity, screenshots, selected DOM elements, and audit output.
- Its architecture is easy to reason about because the extension, middleware server, and MCP server are named explicitly.
- Audit Mode and Debugger Mode package repeated diagnostic sequences instead of forcing the agent to discover every tool call.
- It competes by making the browser a source of debugging evidence, not just a click target.

## What Is Good

- The product teaches users what is running locally and why two server processes exist.
- It keeps the workflow inside MCP-compatible coding tools, which matches the way browser bugs are often handled.
- The README explicitly calls out sensitive-header and cookie stripping, which is the right trust conversation for browser logs.
- Lighthouse-style accessibility, performance, SEO, and best-practice audits are concrete enough for agents to act on.

## Where It Breaks Down

- The repository currently says the project is no longer active, which turns adoption into maintenance risk.
- Setup has several moving parts: extension install, MCP server config, local server, DevTools panel state, and active-tab assumptions.
- The strongest UX still depends on the user understanding Chrome DevTools and MCP client configuration.
- Extension-based browser visibility inherits the broader Chrome-extension trust problem: users must grant page access before they have a mature product-level audit trail.

## Screenshot References

- GitHub README and architecture diagram: `https://github.com/AgentDeskAI/browser-tools-mcp`
- Documentation surface: `https://browsertools.agentdesk.ai/`
