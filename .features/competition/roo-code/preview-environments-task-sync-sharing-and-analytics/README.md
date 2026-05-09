# Preview Environments, Task Sync, Sharing, And Analytics

- Harness: Roo Code
- Sourced: 2026-05-09

## What it is
Roo Cloud pairs cloud preview environments with live task monitoring, shareable task links, and usage analytics so long-running work can be observed and handed off outside the IDE.

## Evidence
- Official docs: [Preview Environments](https://docs.roocode.com/roo-code-cloud/environments)
- Official docs: [Task Sync/Monitoring](https://docs.roocode.com/roo-code-cloud/task-sync)
- Official docs: [Task Sharing](https://docs.roocode.com/roo-code-cloud/task-sharing)
- Official docs: [Usage Analytics](https://docs.roocode.com/roo-code-cloud/analytics)
- First-party details:
  - preview environments can expose multiple ports with unique public URLs and injected environment variables for inter-service communication
  - Roo clones repos, starts services, and runs configured commands inside the cloud environment
  - Task Sync streams local extension task activity to Roo Cloud for near-real-time monitoring from another device
  - task sharing supports organization-only or public secure links
  - analytics can slice tasks, tokens, inference cost, and cloud runtime by user, agent, model, repository, source, PR, provider, and timeframe
- Latest development checkpoint:
  - Roo documents preview infra, task visibility, sharing, and analytics as one operational bundle, which suggests the product sees remote execution and remote supervision as inseparable

## Product signal
Roo is building toward an observable remote-work loop where execution, visibility, and handoff all stay inside the harness rather than leaking into separate tooling.
