# Agent Skills Discovery

- Harness: OpenCode
- Sourced: 2026-04-27

## What it is
OpenCode discovers reusable `SKILL.md` definitions from project and global locations, including compatibility paths used by Claude-style and agent-style ecosystems.

## Evidence
- Official docs: [Agent Skills](https://opencode.ai/docs/skills)
- First-party details:
  - project skills can live under `.opencode/skills/<name>/SKILL.md`
  - OpenCode also reads `.claude/skills/` and `.agents/skills/` compatibility paths
  - skills are loaded on demand through the native `skill` tool
  - access to skills can be controlled through permissions and customized per agent

## Product signal
OpenCode is betting on a portable skill ecosystem where reusable behaviors can move across repos and even across harness families.
