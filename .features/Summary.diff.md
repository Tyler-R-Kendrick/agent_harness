# Summary Diff For Linear Feature Generation

Updated: 2026-06-08
Baseline: `.features/Summary.md` refreshed through the 2026-06-07 OpenAI Symphony corpus.
Diff type: additive updates after the 2026-06-08 Claude Cowork refresh

## Net new normalized features

### Added: Cloud-brokered remote MCP connectors with tool-level policy ceilings
- Why now: the refreshed Claude Cowork corpus now has a precise first-party connector contract for remote MCP, cloud-brokered network access, and cross-surface tool policy enforcement that was not captured in the earlier Cowork slice.
- Research delta:
  - Anthropic's current connector docs now expose custom connectors using remote MCP on Claude, Cowork, and Claude Desktop, including URL plus optional OAuth settings from `Customize > Connectors`
  - the connector traffic originates from Anthropic's cloud even when the user is running Cowork locally, so MCP servers must be public or explicitly allowlist Anthropic IP ranges
  - Anthropic explicitly separates these remote connectors from local MCP servers configured in `claude_desktop_config.json`, and says the local-desktop path is not available in Cowork
  - Enterprise custom roles can now scope access to whole connectors or individual tools with `Always allow`, `Needs approval`, and `Blocked`, and those ceilings are enforced across web, desktop, mobile, and Cowork
  - connector loading also has `Auto` versus `On demand` modes, which makes connector density part of the active conversation contract instead of a hidden global setting

## Expanded normalized features

### Expanded: External tool connectivity and actionability
- Why now: the refreshed Claude Cowork corpus shows a stronger distinction between cloud-brokered connectors and local-machine integrations than the current summary captured.
- Research delta:
  - Cowork is not just exposing "more connectors"; it is defining which integrations run through Anthropic's cloud and therefore inherit cross-surface account portability and central policy enforcement
  - the docs now spell out that local MCP and remote MCP are different trust planes with different reachability and policy assumptions
  - Enterprise connector permissions can cap or block individual tools before the user-level approval menu is even shown, which is stronger than a generic read-write connector toggle
  - this pushes the broader connectivity pattern toward explicit connector brokerage, policy ceilings, and portable approval semantics rather than one-off local tool wiring

## Linear-ready feature payloads

### Proposed Linear feature: Add cloud-brokered remote MCP connectors with tool-level policy ceilings
- Linear issue title:
  - `Add cloud-brokered remote MCP connectors with tool-level policy ceilings`
- Suggested problem statement:
  - `agent-browser` already exposes tools and MCP-style integrations, but it still treats most connectivity as a local-session concern instead of a portable connector plane with centralized policy. Competitors are now separating remote MCP connectors from local-machine MCP, brokering those remote connectors through an account-level cloud path that works across desktop, mobile, web, and Cowork surfaces while enforcing per-tool ceilings before a run ever starts. Without an explicit remote-connector control plane, agent-browser cannot give teams portable connected actions, clear network-boundary semantics, or reliable cross-client approval policy. The product needs a cloud-brokered connector layer for remote MCP services, a visible distinction between local and remote trust planes, and role-aware per-tool ceilings that remain consistent across every client surface.`
- One-shot instruction for an LLM:
  - Implement cloud-brokered remote MCP connectors for `agent-browser`: add an account or workspace connector registry for remote MCP endpoints with optional OAuth configuration; make those connectors callable from browser, desktop, mobile, and background runs without re-registering them per client; clearly show whether each integration is `remote_cloud_brokered` or `local_host_attached`; require public reachability or explicit allowlist guidance for cloud-brokered endpoints; add per-tool policy ceilings such as `always_allow`, `needs_approval`, and `blocked` that are enforced before user-level approval preferences; and ensure blocked or capped tools render consistently across every client and fail closed when policy or connector state cannot load.
