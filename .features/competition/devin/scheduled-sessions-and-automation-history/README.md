# Scheduled Sessions And Automation History

- Harness: Devin
- Sourced: 2026-05-02

## What it is
Devin supports scheduled agent runs with execution history, notifications, and different automation agent types so recurring work can happen without a human opening a fresh session each time.

## Evidence
- Official docs: [Scheduled Sessions](https://docs.devin.ai/product-guides/automations/scheduled-sessions)
- Official docs: [Notifications](https://docs.devin.ai/product-guides/automations/notifications)
- Official release notes: [Devin Release Notes 2026](https://docs.devin.ai/release-notes/2026)
- First-party details:
  - the scheduled-session docs describe recurring runs as a first-class automation surface rather than a hidden API cron example
  - the docs expose automation history and notification controls so users can inspect what happened after the run
  - the January 22, 2026 release notes mention new automation agent types, which implies Devin is specializing scheduled work instead of using one generic background profile
- Latest development checkpoint:
  - current docs position scheduled sessions as an operational workflow with observability and follow-up paths, not just a timer hook

## Product signal
Devin is reinforcing the category move from foreground assistant toward unattended operational agent.
