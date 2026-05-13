# Imports And Persistent Local Project State

- Harness: Open Design
- Sourced: 2026-05-13

## What it is
Open Design preserves design work as a persistent local project and can import both Claude Design exports and existing local folders into that same managed workspace.

## Evidence
- Official README: [Open Design](https://github.com/nexu-io/open-design)
- Official release notes: [Open Design 0.6.0](https://github.com/nexu-io/open-design/releases)
- First-party details:
  - the welcome flow can import a Claude Design export ZIP into a real Open Design project
  - the `0.6.0` release adds importing an existing local folder as a project
  - persistent state lives in `.od/app.sqlite` and includes projects, conversations, messages, tabs, and saved templates
  - the README says users can reopen later and find their todo card and open files in the same place
- Latest development checkpoint:
  - the May 9, 2026 `0.6.0` release broadens ingestion from one migration path to a more general local-project onboarding flow

## Product signal
Open Design treats continuity as workspace state, not as a disposable chat transcript, which makes design iterations resumable and migratable across tools.
