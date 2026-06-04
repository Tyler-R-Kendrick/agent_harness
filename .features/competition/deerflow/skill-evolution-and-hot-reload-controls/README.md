# Skill Evolution And Hot-Reload Controls

- Harness: DeerFlow
- Sourced: 2026-06-04

## What it is
DeerFlow makes skills runtime-governed objects: operators can enable or disable them instantly, restrict them per custom agent, and optionally let the agent create or improve custom skills under security scanning.

## Evidence
- DeerFlow docs: [Skills](https://deerflow.tech/en/docs/harness/skills)
- First-party details:
  - skill availability is tracked in `extensions_config.json` and can be toggled in the App UI, through Gateway API endpoints, or by editing the file directly
  - `load_skills()` re-reads the extensions config on every call, so enablement changes apply without a restart
  - skill loading runs a security scan before injecting content into the agent context
  - custom agents can be limited to a named subset of skills or have skills disabled entirely
  - optional `skill_evolution` allows agent-managed creation and improvement of skills in `skills/custom/`, gated by trust and moderation settings

## Product signal
DeerFlow is pushing workflow packages toward live-governed runtime assets rather than static prompt folders that only change through redeploys.
