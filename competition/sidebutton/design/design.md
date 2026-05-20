# SideButton Design

## Look And Feel

- Marketing uses a dark, developer-tool aesthetic with code snippets, compatibility cards, skill-pack cards, and role labels.
- The site foregrounds setup commands and package catalog entries rather than abstract AI imagery.
- The dashboard is described as a Svelte UI for workflow browsing, run logs, skill-pack management, and system status.
- Visual hierarchy is catalog-first: MCP clients, knowledge packs, role playbooks, and quick-start commands form the main scan path.

## Design Tokens Observed

```yaml
visual_language:
  mode: dark developer dashboard
  surfaces: command blocks, cards, registry entries, status panels
  accent_style: small symbolic initials and compact module counts
  information_density: high
  motion: not central in observed public docs
interaction_patterns:
  primary_action: npx sidebutton@latest
  secondary_actions:
    - install extension
    - browse knowledge packs
    - create a skill
  dashboard_surfaces:
    - workflow browser
    - run logs
    - skill pack manager
    - system status
```

## Differentiators

- The design makes "agent knowledge" tangible. Pack cards show modules, roles, app domains, and specific operational coverage.
- It treats browser automation as a reusable skill surface, not just a generic click/type tool.
- The quick-start flow is strong: install, add MCP endpoint, and ask the coding agent to navigate.
- The catalog shape is good for agents and humans because the same pack metadata can drive discovery, routing, and documentation.

## Where It Breaks Down

- The public surface mixes "knowledge packs", "skill packs", MCP server, workflows, dashboard, and browser extension. That breadth can make the first-time mental model heavier than a single-purpose browser tool.
- Much of the value depends on pack quality. A weak or stale selector pack could make the product feel broken even when the core browser bridge works.
- The registry/card UI is information-dense and developer-friendly, but less approachable for non-technical users who just want a visible browser agent with approvals.
- The April 2026 site note says pricing and solution pages were removed, which leaves the commercial model less explicit for buyers.

## Sources

- https://sidebutton.com/
- https://docs.sidebutton.com/
- https://github.com/sidebutton/sidebutton
