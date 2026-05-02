# Skills Registry And `AGENTS.md` Context

- Harness: OpenHands
- Sourced: 2026-05-02

## What it is
OpenHands treats skills as a first-class extension system. It supports always-on repository context such as `AGENTS.md`, on-demand `SKILL.md` packages, optional keyword-triggered loading, and an official community registry for shared skills.

## Evidence
- Official docs: [OpenHands Skills Overview](https://docs.openhands.dev/overview/skills)
- First-party details:
  - OpenHands supports always-on context loaded at conversation start, with `AGENTS.md` recommended for repository-wide instructions
  - optional skills can be loaded on demand through one-directory-per-skill `SKILL.md` packages
  - the docs describe progressive disclosure explicitly so the agent can see a summary first and read full skill content only when needed
  - OpenHands also documents an official shared skill registry
- Latest development checkpoint:
  - the current docs describe an extended AgentSkills standard with optional keyword triggers and progressive disclosure behavior

## Product signal
OpenHands is converging on the same pattern as other strong harnesses: durable repo instructions plus installable workflow assets, with context-window discipline built into the loading model.
