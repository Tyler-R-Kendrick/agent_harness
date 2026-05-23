# Enterprise Governance And Analytics

- Harness: Claude Cowork
- Refreshed: 2026-05-23

## What it is
Cowork now includes an enterprise governance layer for adoption tracking, policy control, observability, plugin distribution, and group-based enablement.

## Evidence
- Release notes: [April 9, 2026 Cowork GA update](https://support.claude.com/en/articles/12138966-release-notes)
- Official docs: [Use Claude Cowork on Team and Enterprise plans](https://support.claude.com/en/articles/13455879-cowork-for-team-and-enterprise-plans)
- Analytics docs: [View usage analytics for Team and Enterprise plans](https://support.claude.com/en/articles/12883420-usage-analytics-for-team-and-enterprise-plans)
- Monitoring docs: [Monitor Claude Cowork activity with OpenTelemetry](https://support.claude.com/en/articles/14477985-monitor-claude-cowork-activity-with-opentelemetry)
- First-party details:
  - Cowork is now exposed in the Analytics API and the admin analytics dashboard
  - analytics include Cowork sessions per day, active-user coverage, and Cowork-specific adoption metrics
  - OpenTelemetry exports stream prompts, tool and MCP calls, file access, skills and plugins used, approvals, token counts, cost, and errors
  - Team and Enterprise owners can manage plugin marketplaces and organization-level branding
  - Enterprise admins can use groups and custom roles to selectively enable Cowork and tune plugin availability
  - Anthropic is explicit that Cowork activity is still not captured in the Compliance API, so OTel is the current monitoring path
- Latest development checkpoint:
  - current help-center guidance has moved from simple "admin controls exist" wording to a fuller operating model around analytics, OTel, group policy, and plugin governance

## Product signal
Anthropic is treating visibility and policy as first-class harness features, which reinforces that agent adoption in larger orgs now depends on telemetry and rollout control, not just model quality.
