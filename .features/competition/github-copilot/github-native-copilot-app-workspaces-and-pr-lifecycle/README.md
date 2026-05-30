# GitHub-Native Copilot App Workspaces And PR Lifecycle

- Harness: GitHub Copilot
- Sourced: 2026-05-30

## What it is
GitHub now ships a dedicated Copilot desktop app that turns issue triage, parallel agent workspaces, PR review, CI checks, and merge follow-through into one GitHub-native control surface built on Copilot CLI.

## Evidence
- Docs: [About the GitHub Copilot app](https://docs.github.com/en/copilot/concepts/agents/github-copilot-app)
- Docs: [GitHub Copilot app](https://docs.github.com/en/copilot/how-tos/github-copilot-app)
- Docs: [Customize the GitHub Copilot app](https://docs.github.com/en/copilot/how-tos/github-copilot-app/customize-github-copilot-app)
- Changelog: [GitHub Copilot app is now available in technical preview](https://github.blog/changelog/2026-05-14-github-copilot-app-is-now-available-in-technical-preview/)
- GitHub documents:
  - the app is purpose-built for agent-driven development and runs multiple isolated sessions, each with its own git worktree and branch
  - users can browse issues, start from a blank workspace, choose `Interactive`, `Plan`, or `Autopilot`, and let the agent create a branch, write code, run tests, and open a PR
  - issue triage, review, CI check visibility, and merge all stay in the same app instead of forcing a terminal, IDE, and browser hop
  - the app exposes scheduled workflows, global instructions, agent skills, and MCP server management as first-class settings

## Product signal
GitHub is packaging the coding harness as a GitHub-native desktop operations console, not just an editor plugin or terminal agent.
