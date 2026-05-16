# Multi-Agent Command Center

- Harness: Codex
- Sourced: 2026-05-16

## What it is
Codex app is positioned as a command center for running multiple threads across projects, with explicit Local, Worktree, and Cloud execution modes.

## Evidence
- OpenAI product post: [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)
- Official docs: [Codex app features](https://developers.openai.com/codex/app/features)
- Key details:
  - agents can be managed "at once" and run "in parallel"
  - work is organized by project and thread
  - the app supports multiple projects in one window
  - built-in worktree support isolates each agent's copy of the repo
  - new-thread mode selection now distinguishes `Local`, `Worktree`, and `Cloud`
  - Windows support was added on March 4, 2026 according to the product post update
- Latest development checkpoint:
  - current first-party docs broaden the command-center story from "parallel threads" into a more explicit execution-mode matrix across local machine, isolated git copies, and cloud environments

## Product signal
This is a strong move from single-agent chat UX toward explicit orchestration plus execution portability.
