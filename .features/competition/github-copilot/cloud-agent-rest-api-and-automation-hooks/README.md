# Cloud Agent REST API And Automation Hooks

- Harness: GitHub Copilot
- Sourced: 2026-05-18

## What it is
Copilot cloud agent can now be started and tracked programmatically through a public-preview REST API, which makes branch-and-PR agent work automatable from external systems.

## Evidence
- Changelog: [Start Copilot cloud agent tasks via the REST API](https://github.blog/changelog/2026-05-13-start-copilot-cloud-agent-tasks-via-the-rest-api/)
- GitHub documents:
  - Business and Enterprise users can start cloud-agent tasks with the new Agent tasks REST API
  - tasks run in Copilot's background development environment, make and validate changes, and open pull requests
  - the API supports programmatic fan-out workflows such as multi-repo refactors, internal developer-portal actions, and release preparation
  - task progress can also be tracked through the API after launch

## Product signal
GitHub is exposing its coding agent as automation infrastructure, not only an interactive UX surface.
