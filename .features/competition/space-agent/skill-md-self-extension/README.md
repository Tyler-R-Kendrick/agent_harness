# SKILL.md Self Extension

- Harness: Space Agent
- Sourced: 2026-04-30

## What it is
Space Agent makes plain-text `SKILL.md` files a first-class way for the agent to add or evolve capabilities from inside the system itself.

## Evidence
- Official README: [agent0ai/space-agent](https://github.com/agent0ai/space-agent)
- Official repo contract: [AGENTS.md](https://raw.githubusercontent.com/agent0ai/space-agent/main/AGENTS.md)
- First-party details:
  - the README says new capabilities can live in simple `SKILL.md` files that the agent can write and extend itself in plain text
  - the repo README describes the framework as AI-driven development with a hierarchical `AGENTS.md` instruction system plus skills and focused docs
  - the root `AGENTS.md` treats documentation and agent instructions as part of the runtime contract, not optional notes
- Latest development checkpoint:
  - the current repo structure continues to foreground `AGENTS.md`, skills, and documentation ownership, which reinforces that self-extending textual capability packs are central to how the system evolves

## Product signal
Space Agent leans into agent-maintained skills and repo-owned instructions as the main extensibility seam, which aligns with the broader shift from ad hoc prompting toward reusable workflow packages.
