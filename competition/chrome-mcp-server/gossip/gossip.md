# Chrome MCP Server Gossip

## Positive Signals

- GitHub shows strong open-source adoption, with thousands of stars, many forks, and active issues.
- The README openly states the project is still early and under intensive development, which sets expectations while signaling momentum.
- Third-party MCP directories describe it as a local intelligent browser server that preserves login state and privacy.

## Negative Signals

- GitHub issues and broader Chrome-MCP community posts show repeated connection-health problems: extensions staying disconnected, HTTP mode not connecting to Claude Code, and Chrome/MCP integrations becoming view-only or unavailable for some users.
- The same local-extension architecture that enables real-browser use creates setup fragility across extension install, server process, MCP client config, browser compatibility, and permissions.
- Open-source breadth can become UX sprawl: many tools are powerful, but users still need a product-level trace, approval, and recovery model.

## Bug And UX Risk Themes

- Connection failures are the main operational risk.
- Local browser authority needs sharper user-facing controls around cookies, profile data, prompt injection, network access, and page scripts.
- Semantic search and smart extraction are useful, but agent decisions still need screenshots, logs, and replayable evidence to be trusted.

## Sources

- https://github.com/hangwin/mcp-chrome
- https://playbooks.com/mcp/hangwin-chrome
- https://deepwiki.com/hangwin/mcp-chrome
- https://github.com/hangwin/mcp-chrome/issues/181
- https://www.reddit.com/r/ClaudeAI/comments/1t3k7rq/cowork_cant_connect_to_chrome_mcp_since_last/
