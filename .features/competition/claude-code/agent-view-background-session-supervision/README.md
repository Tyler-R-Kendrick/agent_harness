# Agent View Background Session Supervision

- Harness: Claude Code
- Sourced: 2026-06-05

## What it is
Claude Code now has an Agent View surface for supervising background sessions instead of leaving long-running tasks buried in separate terminals.

## Evidence
- Docs: [Agent view](https://code.claude.com/docs/en/agent-view)
- What's New: [Week 20 · May 11–15, 2026](https://code.claude.com/docs/en/whats-new/2026-w20)
- The current docs position Agent View as a place to:
  - group background sessions under `Needs input`, `Working`, and `Completed`
  - peek into the most recent output or blocker question without attaching the full transcript
  - reply to a running task from the peek panel and then return to the supervision list
  - background an existing session with `/bg` and bring it under the same control surface
  - scope the session list to a directory with `--cwd`
  - pass through settings, plugins, MCP servers, and additional directories to every dispatched session
- First-party visuals:
  - Anthropic includes terminal screenshots of Agent View with grouped session states, summary counts, and dispatch input

## Product signal
Anthropic is treating background-run supervision as a first-class operations console, not just a terminal convenience.
