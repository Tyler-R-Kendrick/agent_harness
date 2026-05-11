# BrowserMCP Gossip

## Positive Signals

- Strong GitHub and directory interest indicates real demand for local browser control through MCP.
- Public positioning maps directly to known browser-agent pain: login friction, bot detection, privacy, and network latency.
- MCP directory presence helps it ride the assistant tooling adoption curve.

## Negative Signals

- Open issues call out practical reliability gaps: infinite loops, click failures, tab ID persistence, multi-tab support, broken docs links, and unclear extension connectivity.
- Cursor community discussion about browser MCP tools looping and draining usage units shows that the wider tool category can create expensive runaway behavior when agent/tool boundaries are weak.
- The README's standalone-build caveat is a trust issue for an open-source product that sells itself on local transparency.

## Buggy Or Risky Areas

- Extension connection status and server identity.
- Multi-tab/task isolation.
- Tool-loop termination and credit burn in MCP clients.
- Lack of first-class recordings or trace review compared with managed browser platforms.

## Sources

- `https://github.com/BrowserMCP/mcp/issues`
- `https://forum.cursor.com/t/any-browser-mcp-tools-get-stuck-in-an-infinite-loop-and-burn-units/109175`
