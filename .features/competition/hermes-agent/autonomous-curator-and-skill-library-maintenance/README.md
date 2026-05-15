# Autonomous Curator And Skill Library Maintenance

- Harness: Hermes Agent
- Sourced: 2026-05-15

## What it is
Hermes includes a background Curator agent that audits self-authored skills, ranks them by real usage, proposes consolidations, and archives stale items with recoverable state.

## Evidence
- Official docs: [Curator](https://hermes-agent.nousresearch.com/docs/user-guide/features/curator)
- Official release: [Hermes Agent v0.12.0](https://github.com/NousResearch/hermes-agent/releases)
- First-party details:
  - `hermes curator` runs as a background agent on the gateway ticker with a seven-day default cycle
  - the Curator tracks `use_count`, `view_count`, `patch_count`, timestamps, and state transitions such as `active`, `stale`, and `archived`
  - pinned skills are protected from deletion while still allowing content improvements
  - archived skills can be restored instead of being permanently deleted
- Latest development checkpoint:
  - the April 30, 2026 `v0.12.0` release moved Curator into the main product narrative and tied it to the broader self-improvement loop rather than leaving it as an experimental side utility

## Product signal
Hermes is productizing harness self-maintenance, which turns skill sprawl and workflow drift into an explicit operational problem the agent can manage.
