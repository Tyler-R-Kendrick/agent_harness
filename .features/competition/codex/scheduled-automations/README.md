# Scheduled Automations

- Harness: Codex
- Sourced: 2026-05-16

## What it is
Codex app can run automations on schedules in the background, route findings into a triage inbox, and choose whether each run executes in the local project or a dedicated worktree.

## Evidence
- Official product post: [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)
- Official docs: [Automations](https://developers.openai.com/codex/app/automations)
- First-party details:
  - automation runs add findings to the inbox and auto-archive when there is nothing to report
  - automations can combine prompts with skills
  - git-backed projects can run in the local checkout or in a new background worktree
  - the app supports custom schedules with cron syntax
  - thread automations exist for work that should stay attached to one ongoing thread
  - the automations sidebar includes a Triage section that acts as an inbox for runs with findings
- Examples mentioned by OpenAI:
  - daily issue triage
  - CI failure summaries
  - daily release briefs
  - recurring bug checks
- Latest development checkpoint:
  - Codex automations now have clearer execution-mode, inbox, and thread-continuity semantics than the initial launch framing suggested

## Product signal
Codex is expanding from interactive execution into a lightweight background operations system.
