# Scheduled Automations

- Harness: Hermes Agent
- Sourced: 2026-05-15

## What it is
Hermes includes built-in scheduled execution through its gateway and cron surfaces so recurring work, watchdogs, and background maintenance can keep running without an active foreground chat.

## Evidence
- Official site: [Hermes Agent](https://hermes-agent.org/)
- Official release: [Hermes Agent v0.13.0](https://github.com/NousResearch/hermes-agent/releases)
- Official docs: [Curator](https://hermes-agent.nousresearch.com/docs/user-guide/features/curator)
- First-party details:
  - the product site advertises built-in cron scheduling for daily reports, nightly backups, weekly audits, and morning briefings
  - the Curator feature runs as a background maintenance pass over agent-authored skills
  - the v0.13.0 release says cron gained a `no_agent` watchdog mode
  - the gateway architecture docs describe cron ticking and background maintenance inside the long-running gateway process
- Latest development checkpoint:
  - the latest release is still expanding unattended execution rather than freezing it at simple recurring reminders

## Product signal
Hermes is building toward a resident agent service that can monitor, maintain, and deliver work on its own schedule.
