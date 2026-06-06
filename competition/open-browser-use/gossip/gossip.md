# Open Browser Use Gossip

## What People Say

- Launch and directory pages frame the product as a direct response to agents needing real Chrome without hosted Browser Use lock-in.
- Nearby MCP/community discussion repeatedly asks for agents that can use existing browser profiles, logged-in tabs, Chrome extensions, and local state.
- Users also warn that profile routing and account scope are the hard parts: the agent must not post, click, or download through the wrong identity.

## Product And Design Complaints

- The low-level bridge is useful but does not by itself answer "what did the agent do, why, and can I replay or approve it?"
- Native host plus extension setup can be fragile across operating systems, browser updates, enterprise device policies, and Chrome Web Store availability.
- Clipboard, downloads, file chooser helpers, and CDP access are powerful primitives that need visible scope and audit controls.

## Security And Trust Signals

- Local-only transport is a strong privacy story compared with cloud screenshots or remote browser farms.
- Real-profile control is also the risk: cookies, accounts, storage, downloads, and clipboard can become ambient authority unless the host agent constrains them.
- Open-source licensing enables audit, but most users will still rely on package distribution, extension review, and update-chain trust.

## Implications For Agent Browser

- Open Browser Use is a direct competitive signal: local real-Chrome agent control is becoming a commodity MCP layer.
- `agent-browser` should compete above the bridge with durable evidence, state boundaries, screenshots, traces, approvals, profile routing, and recovery workflows.
- SDK and skill packaging should stay first-class because competitors are meeting developers where they already run Codex and Claude Code.

## Sources

- https://github.com/iFurySt/open-browser-use
- https://www.producthunt.com/products/open-browser-use
- https://www.reddit.com/r/ClaudeCode/comments/1ti8c2q/i_built_a_local_browser_handle_for_agent_workflows/
- https://www.reddit.com/r/mcp/comments/1sfd1es/showcase_i_built_an_mcp_server_that_lets_agents/
- https://www.reddit.com/r/opencodeCLI/comments/1qsrxqs/browser_automation_with_my_active_profile/
