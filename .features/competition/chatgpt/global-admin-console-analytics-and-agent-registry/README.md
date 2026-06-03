# Global Admin Console Analytics And Agent Registry

- Harness: ChatGPT
- Sourced: 2026-06-03

## What it is
ChatGPT now gives workspace operators a global admin surface that combines analytics with an inspectable registry of shared workspace agents, so admins can see adoption, drill into agent configuration and schedules, and jump into editing when an agent needs attention.

## Evidence
- Business release notes: [ChatGPT Business - Release Notes](https://help.openai.com/en/articles/11391654-chatgpt-business-release-notes)
- Help article: [Workspace analytics for ChatGPT Enterprise and Edu](https://help.openai.com/en/articles/10875114)
- First-party details:
  - the global admin console includes dedicated `Analytics` and `Agents` areas
  - analytics expose active-user and message trends plus drilldowns for GPTs, projects, skills, tool interactions, connector interactions, and workspace health
  - the agents area lets admins inspect Agent ID, recent activity, connected apps, memory files, schedules, and unique users or runs over time
  - admins can move from the registry into Builder to edit an agent
  - workspace analytics also includes project and skill usage trends, task insights, benchmarks, impact surveys, and CSV exports
  - analytics are aggregated rather than raw-log views, and OpenAI directs compliance use cases to the Compliance API instead
- Official visuals:
  - the analytics help article documents the dashboard sections and export flows, and the Business release notes position the Agents area as part of the same admin console
- Latest development checkpoint:
  - OpenAI is no longer treating shared agents as hidden artifacts; they are now inventory items with health, usage, and edit handoff surfaces

## Product signal
ChatGPT is making shared-agent operations into a first-class admin workflow, where operators supervise adoption and individual agent health from the same governed console.
