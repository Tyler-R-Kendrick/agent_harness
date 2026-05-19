# Skills As Schedulable Cloud Agents

- Harness: Warp
- Sourced: 2026-05-19

## What it is
Warp lets teams promote repo-defined skills into reusable cloud agents that can be run visually, from the CLI or API, and on a schedule.

## Evidence
- Official docs: [Skills as agents](https://docs.warp.dev/agent-platform/cloud-agents/skills-as-agents)
- Official docs: [Scheduled Agents](https://docs.warp.dev/agent-platform/cloud-agents/triggers/scheduled-agents)
- First-party details:
  - local skills are auto-discovered from the current repository, while cloud runs discover skills from repositories attached to an environment
  - discovered skills appear in the Agents list in the Oz web app and can also be listed programmatically through the API
  - Warp exposes the same skill-based launch model through the Oz web app, `oz agent run`, `oz agent run-cloud`, and API `skill_spec`
  - scheduled runs can target a skill directly, which turns repeatable prompt logic into durable automation rather than ad hoc reuse
- Latest development checkpoint:
  - Warp's May 2026 docs make skill discovery and scheduled skill execution part of the mainstream cloud-agent path, not a sidecar power-user feature

## Product signal
Warp is turning reusable prompt logic into a catalog of runnable agents, which is a stronger packaging model than static prompt snippets or undocumented cron jobs.
