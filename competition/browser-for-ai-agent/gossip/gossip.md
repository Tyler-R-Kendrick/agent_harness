# Browser for AI Agent Gossip

## What People Say

- The Reddit launch post frames the product as a way for Claude and any MCP agent to read and control open browser tabs, including logged-in SaaS, internal dashboards, and localhost.
- The appeal is clear: agents get the same authenticated context the user already has.

## Design Sentiment

- Positive: local extension plus native host is understandable to MCP power users.
- Positive: explicit security warnings increase credibility.
- Negative: pending store review and manual release installation reduce mainstream trust.

## Feature Sentiment

- Positive: page tools and WebMCP support are a more structured path than generic click/type loops.
- Positive: reading errors, cookies, storage, and screenshots can make debugging and app-specific automation stronger.
- Negative: those same capabilities are sensitive and could be abused by prompt injection or malicious toolsets.

## Marketing Sentiment

- Good: "read and control your browser tabs" is concrete and easy to explain.
- Risk: the product needs more visible permission design before broader adoption beyond technical MCP users.

## Bugs And Friction To Watch

- Native host registration and extension install can fail differently across Chrome, Edge, and Firefox.
- Only one browser can work when the extension needs to listen on a local port.
- Tool provenance and page-script execution need durable audit logs, not only install-time warnings.
