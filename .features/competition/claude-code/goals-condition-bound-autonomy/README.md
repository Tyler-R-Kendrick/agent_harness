# Goals Condition-Bound Autonomy

- Harness: Claude Code
- Sourced: 2026-06-05

## What it is
Claude Code now treats long-running autonomy as an explicit goal contract: users define a completion condition, and the session keeps working across turns until that condition holds.

## Evidence
- Docs: [Keep Claude working toward a goal](https://code.claude.com/docs/en/goal)
- What's New: [Week 20 · May 11–15, 2026](https://code.claude.com/docs/en/whats-new/2026-w20)
- Current first-party details:
  - `/goal` requires Claude Code v2.1.139 or later
  - users set a completion condition instead of restating the next prompt every turn
  - after each turn, a small fast model evaluates whether the condition holds
  - if the condition is still false, Claude automatically starts another turn instead of returning control
  - Anthropic positions it for verifiable end states such as passing tests, satisfying acceptance criteria, size-budget reductions, or clearing a labeled backlog
  - the same contract is documented for interactive sessions, non-interactive `-p` runs, and Remote Control

## Product signal
Claude Code is making success criteria a first-class runtime primitive, which is a stronger automation contract than ordinary chat turns or open-ended loops.
