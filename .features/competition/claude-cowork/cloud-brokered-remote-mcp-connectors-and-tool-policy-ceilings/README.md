# Cloud Brokered Remote MCP Connectors And Tool Policy Ceilings

- Harness: Claude Cowork
- Refreshed: 2026-06-08

## What it is
Claude Cowork now treats remote MCP connectors as a first-class, cross-surface integration layer, but Anthropic explicitly brokers those connectors from its cloud and applies role and tool policy ceilings above the user-level auth flow.

## Evidence
- Official docs: [Use connectors to extend Claude's capabilities](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities)
- Official docs: [Get started with custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- Official docs: [Manage custom roles on Enterprise plans](https://support.claude.com/en/articles/13930452-manage-custom-roles-on-enterprise-plans)
- First-party details:
  - Anthropic now exposes custom connectors using remote MCP on Claude, Cowork, and Claude Desktop across Free, Pro, Max, Team, and Enterprise plans.
  - custom connectors are added from `Customize > Connectors`, can include OAuth client settings, and then follow the same connection flow as directory connectors.
  - even in Cowork, connector traffic originates from Anthropic's cloud infrastructure rather than from the local machine, so remote MCP servers must be reachable over the public internet or allowlist Anthropic IP ranges.
  - Anthropic explicitly distinguishes these cloud-brokered connectors from local MCP servers configured in `claude_desktop_config.json`, and says those local servers are not available in Cowork.
  - Enterprise custom roles can scope access at the connector and per-tool level with `Always allow`, `Needs approval`, or `Blocked`, and Anthropic enforces the resulting ceiling across web, desktop, mobile, and Cowork.
  - connector permissions fail closed and can gray out tools, hide blocked connectors, or remove the user's `Always allow` option when the org or role policy requires per-call approval.
  - connector loading itself now has user-facing `Auto` and `On demand` modes, which Anthropic positions as a context-budget control for conversations with many connected services.
- Latest development checkpoint:
  - the current first-party connector and custom-role docs have turned Cowork's connector story from a generic "integrations exist" claim into a precise runtime contract around cloud brokerage, public-network reachability, cross-surface enforcement, and per-tool approval ceilings.

## Screenshots and demos
- Anthropic's connector help articles currently document the flow with UI instructions and configuration steps, but they do not appear to publish a dedicated Cowork-specific connector screenshot or GIF for this feature.

## Product signal
Cowork is no longer just "desktop agent plus plugins." Anthropic is defining a stronger integration boundary where remote MCP connectors are portable across clients, centrally governable, and intentionally separated from local-machine MCP trust assumptions.
