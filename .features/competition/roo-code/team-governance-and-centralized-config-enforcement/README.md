# Team Governance And Centralized Config Enforcement

- Harness: Roo Code
- Sourced: 2026-05-09

## What it is
Roo's Team plan adds a governance layer for shared cloud agents, centralized billing, organization-level integrations, and enforced extension configuration.

## Evidence
- Official docs: [Team Plan](https://docs.roocode.com/roo-code-cloud/team-plan)
- Official docs: [Roo Code Cloud Overview](https://docs.roocode.com/roo-code-cloud/overview)
- First-party details:
  - teams get centralized LLM billing without each user managing API keys
  - organizations get team-wide task history and token usage analytics
  - shared Cloud Agents run under centralized billing and shared integrations
  - GitHub and Slack integrations can be managed centrally instead of per user
  - org admins can enforce extension configuration such as providers, models, and MCP servers
  - organization settings also cover task sync policy, task sharing policy, and encrypted environment variables for cloud runs
- Latest development checkpoint:
  - Roo frames governance as extension policy plus cloud control plane, which is broader than a simple billing dashboard or admin-only seat management page

## Product signal
Roo is treating team rollout as a policy problem, not just a pricing tier, with shared control over both local and cloud agent behavior.
