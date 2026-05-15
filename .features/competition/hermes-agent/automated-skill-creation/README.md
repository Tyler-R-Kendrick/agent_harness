# Automated Skill Creation

- Harness: Hermes Agent
- Sourced: 2026-05-15

## What it is
Hermes treats self-authored skills as a core learning primitive: it can write reusable `SKILL.md` documents after solving novel problems, then later refine or consolidate those skills as part of its own maintenance loop.

## Evidence
- Official site: [Hermes Agent](https://hermes-agent.org/)
- Official docs: [Curator](https://hermes-agent.nousresearch.com/docs/user-guide/features/curator)
- Official release: [Hermes Agent v0.12.0](https://github.com/NousResearch/hermes-agent/releases)
- First-party details:
  - Hermes markets auto-created skills as searchable, shareable, and compatible with the `agentskills.io` standard
  - the v0.12.0 release says the post-turn self-improvement loop decides what memories or skills to save or update after each run
  - the Curator docs describe a background maintenance pass that grades agent-created skills, tracks usage and patch counts, and archives or consolidates stale skills without touching bundled or hub-installed skills
- Latest development checkpoint:
  - the latest first-party docs and the April 30, 2026 `v0.12.0` release position self-authored skill maintenance as an active runtime loop rather than a one-time "save this snippet" convenience

## Product signal
Hermes is moving beyond one-shot skill capture toward a governed procedural-memory lifecycle where the harness writes, measures, consolidates, and prunes its own learned workflows.
