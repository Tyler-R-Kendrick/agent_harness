# Agent View Background Session Supervision

- Harness: Claude Code
- Sourced: 2026-05-22

## What it is
Claude Code now has an Agent View surface for supervising background sessions instead of leaving long-running tasks buried in separate terminals.

## Evidence
- Docs: [Agent view](https://code.claude.com/docs/en/agent-view)
- The official docs position Agent View as a place to:
  - see active and completed background sessions
  - peek into an agent's current progress
  - reply to or steer a running task without reattaching the full terminal session
  - manage multiple agents from one supervision surface

## Product signal
Anthropic is treating background-run supervision as a first-class control plane, not just a terminal convenience.
