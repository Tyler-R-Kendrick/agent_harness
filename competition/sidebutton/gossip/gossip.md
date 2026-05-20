# SideButton Gossip

## Positive Signals

- The GitHub repository is public and describes a concrete stack: MCP server, Chrome extension, YAML workflow engine, knowledge packs, REST API, and dashboard.
- The homepage includes a customer quote around legacy-system migration and autonomous verification, which is a credible high-value workflow if validated.
- The product matches a real community pain point: browser agents need domain knowledge, not only screenshots and click tools.

## Negative Signals

- Public GitHub visibility was still small at snapshot time, so community proof is early.
- The repo showed open issues and pull requests, which is normal for a young OSS project but means adopters should expect movement in APIs and packaging.
- The public site note that the April 2026 redesign removed pricing and solution pages may make procurement and buyer qualification harder.

## Category Chatter

- MCP community discussion is increasingly focused on whether servers leak too much authority, have vague tool contracts, or produce huge context payloads.
- Browser automation chatter repeatedly criticizes screenshot and pixel-click loops as brittle, while favoring DOM, accessibility-tree, or app-specific API approaches.
- SideButton's knowledge-pack strategy addresses that complaint, but it also adds a new maintenance surface: every pack becomes a contract that can drift when the target app changes.

## Bug And UX Risks To Watch

- Extension connection and local server state can fail independently.
- Knowledge packs may hide stale selectors behind confident role playbooks.
- YAML workflows could become another opaque automation language unless logs and validation are excellent.
- Embedded buttons injected into arbitrary pages need careful trust and permission messaging.

## Sources

- https://github.com/sidebutton/sidebutton
- https://www.reddit.com/r/mcp/comments/1le81tq
- https://www.reddit.com/r/mcp/comments/1teoo6q
