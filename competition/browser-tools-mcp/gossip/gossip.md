# BrowserTools MCP Gossip

## Positive Signals

- The GitHub repository shows strong open-source attention, with thousands of stars and hundreds of forks at the time of review.
- The README update history highlights concrete bug-fix work around Windows connectivity, auto-discovery, auto-reconnect, and graceful shutdown.
- The product became popular because it solved a narrow pain: coding agents often cannot see the browser artifacts developers use to debug.

## Negative Signals

- The repository banner says the project is no longer active and tells users to use a different solution.
- The setup instructions warn users about common failure modes: only one DevTools panel, restarting Chrome, restarting the local server, and extension/server/MCP connection state.
- Public security research on GenAI Chrome extensions reinforces the category risk: extension permissions and browser data access are a major trust boundary even when a specific project is benign.

## Bug And UX Complaints To Track

- Extension-to-server connectivity failures.
- DevTools panel state and active-tab assumptions.
- Local server lifecycle and port discovery.
- Token-limit truncation losing useful logs.
- User confusion between the browser-tools-server and browser-tools-mcp processes.

## Sources

- https://github.com/AgentDeskAI/browser-tools-mcp
- https://browsertools.agentdesk.ai/
- https://arxiv.org/abs/2512.10029
