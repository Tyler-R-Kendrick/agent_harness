# Agent Sessions Tab And Live Logs

- Harness: GitHub Copilot
- Sourced: 2026-05-05

## What it is
GitHub gives Copilot a first-class agent session surface with a global agents tab, per-session logs, live progress, token usage, session duration, CLI tracking, and in-flight steering.

## Evidence
- Docs: [Tracking GitHub Copilot's sessions](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/track-copilot-sessions)
- GitHub documents:
  - an agents panel and agents tab that show running and past sessions across repositories
  - session logs and overview data including progress, token usage, session count, and session length
  - `gh agent-task list` / `gh agent-task view --log --follow` for CLI-side tracking
  - the ability to steer a session while it is still running

## Product signal
GitHub is treating background agent execution as an observable operational surface, not a black-box async job.
