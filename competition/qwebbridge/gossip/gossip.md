# QWebBridge Gossip

## What People Say

- Reddit discussion around extension-based browser MCPs validates the demand for "real Chrome, not a separate browser" automation.
- The main community concern in this category is not whether local bridges are useful; it is whether prompt injection, tab scoping, and logged-in data access are handled safely.

## Design Sentiment

- Positive: the architecture diagram reduces mystery around where data flows.
- Positive: localhost-only framing is a strong privacy claim.
- Negative: local ports, extensions, and skills are still a developer setup pattern.

## Feature Sentiment

- Positive: MCP, WebSocket, HTTP, and CLI surfaces make it flexible.
- Positive: Kimi WebBridge compatibility can lower migration cost for existing users.
- Negative: extension disconnects, daemon status, Chrome permissions, and CDP target selection are likely support hotspots.

## Marketing Sentiment

- Good: "real tabs, real sessions" is a strong wedge against headless browsers.
- Risk: open-source bridge messaging may undersell needed governance around cookies, storage, and authenticated actions.

## Bugs And Friction To Watch

- `extensions_connected: true` health checks become critical because any disconnect breaks the agent loop.
- Multiple local protocols increase documentation and troubleshooting burden.
- Real-browser automation needs explicit allowlists and stop controls to avoid broad tab access.
