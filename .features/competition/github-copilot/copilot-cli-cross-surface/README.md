# Copilot CLI Cross-Surface Continuity

- Harness: GitHub Copilot
- Sourced: 2026-05-30

## What it is
Copilot CLI lets users start work in the terminal or IDE, then monitor or steer the same session from GitHub.com, mobile, VS Code, or JetBrains while carrying forward logs and status across surfaces.

## Evidence
- Docs: [Steering a GitHub Copilot CLI session from another device](https://docs.github.com/en/copilot/how-tos/copilot-cli/steer-remotely)
- Docs: [Managing agent sessions](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/track-copilot-sessions)
- Changelog: [GitHub Copilot in Visual Studio Code, April releases](https://github.blog/changelog/2026-05-06-github-copilot-in-visual-studio-code-april-releases/)
- Changelog: [Remote control for Copilot CLI sessions now generally available on mobile, web, and VS Code](https://github.blog/changelog/2026-05-18-remote-control-for-copilot-cli-sessions-now-generally-available-on-mobile-web-and-vs-code/)
- GitHub documents:
  - `/remote on` exposes ongoing Copilot CLI sessions to GitHub.com and the mobile app
  - remote control is now generally available and supports non-GitHub repositories plus directories that are not associated with a repository
  - VS Code and JetBrains now expose the same remote-control follow-through instead of limiting the flow to browser or phone supervision
  - agent debug logs now persist locally across sessions
  - long-running background terminal commands report their status back into chat
  - Copilot CLI session titles stay synced with the wider agent sessions UX

## Product signal
Continuity across terminal, IDE, browser, and mobile surfaces is becoming a default expectation for serious agent harnesses.
