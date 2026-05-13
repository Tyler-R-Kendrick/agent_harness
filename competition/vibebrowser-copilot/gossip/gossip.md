# VibeBrowser Co-Pilot Gossip

## Positive Signals

- The MCP page claims 25+ tools across browser, workspace, security, and orchestration categories.
- The docs position Vibe MCP as supporting multi-agent control of one browser session, existing browser profiles, logged-in sessions, and local privacy.
- The product explicitly compares itself against Playwright MCP, DevTools MCP, and BrowserMCP, which shows it is competing on current agent-tooling buyer language.

## Negative Signals

- Public independent review volume is thin compared with BrowserOS, BrowserMCP, Playwright MCP, or Browserbase; much of the signal is first-party product copy.
- Documentation notes a current limitation: the local relay models one connected extension session rather than explicit multi-browser selection.
- The older waitlist page uses more aggressive "automate your job" messaging, which may attract hype-sensitive users while making enterprise safety buyers cautious.

## Bug And UX Risk Themes

- Relay/server/extension connectivity can become the first failure mode because users must understand which port or route connects to which component.
- Multi-agent browser control can create race conditions if two agents click or type at once.
- Real-profile access raises the blast radius of prompt injection, accidental sends, account modifications, and leaked browser state.

## Sources

- https://www.vibebrowser.app/
- https://www.vibebrowser.app/mcp
- https://docs.vibebrowser.app/mcp-integration
- https://www.vibebrowser.com/
