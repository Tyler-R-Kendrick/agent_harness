# Devin Design

## Look And Feel

- Work is organized around durable agent sessions rather than a local IDE surface.
- The product emphasizes enterprise controls: integrations, consumption reports, auditability, secrets, guardrails, and organization settings.
- Release notes show continued simplification of dense surfaces, including consolidated session headers, faster code block rendering, scroll restoration, and refreshed settings pages.

## Design Tokens To Track

```yaml
surface: web app, session log, pull requests, Slack, Teams, Jira, Linear, API
accent: enterprise AI engineer
primary_control: start session or assign work item
core_objects:
  - session
  - agent compute unit
  - pull request
  - integration
  - review
  - wiki
  - guardrail
information_density: high
```

## Differentiators

- Treats the agent as a teammate with sessions, PRs, comments, integrations, and admin cost reporting.
- GitHub integration lets Devin create PRs, respond to PR comments, and work inside the buyer's existing source-control review loop.
- Enterprise features such as session ACU hard caps and MCP audit logs make it easier to sell into governed engineering orgs.

## What Is Good

- The session-first model maps to how managers already delegate engineering tickets.
- Consumption reporting by product and repository helps admins understand agent spend.
- Message permalinks, session categorization, review breakdowns, and auto-merge polish reduce coordination friction.

## Where It Breaks Down

- The UI can become an enterprise console instead of a fast local workbench.
- ACU and quota mental models add cost-management work to every long-running task.
- Users still need strong review discipline because the product hands back PRs, not guaranteed-correct shipped outcomes.

## Screenshot References

- GitHub integration screenshots: `https://docs.devin.ai/integrations/gh`
- Release-note UI changes: `https://docs.devin.ai/release-notes/2026`
