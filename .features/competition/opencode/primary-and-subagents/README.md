# Primary And Subagents

- Harness: OpenCode
- Sourced: 2026-04-27

## What it is
OpenCode ships with role-specific built-in agents and lets users switch between them or invoke subagents manually with `@` mentions.

## Evidence
- Official docs: [Agents](https://opencode.ai/docs/agents/)
- First-party details:
  - OpenCode defines two primary agents, `Build` and `Plan`
  - it defines built-in subagents including `General` and `Explore`
  - users can switch primary agents during a session and manually invoke subagents with `@`
  - the `Plan` agent is intentionally restricted for analysis without edits, while `Build` has full tool access

## Product signal
This is a strong example of explicit persona separation with purpose, permissions, and invocation mechanics built into the harness itself.
