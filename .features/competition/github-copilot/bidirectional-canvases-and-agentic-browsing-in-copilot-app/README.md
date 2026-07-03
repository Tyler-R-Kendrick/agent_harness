# Bidirectional Canvases And Agentic Browsing In Copilot App

- Harness: GitHub Copilot
- Sourced: 2026-06-09

## What it is
The GitHub Copilot app is evolving from a transcript-only agent shell into a shared workspace with editable canvases, cloud sessions, cloud automations, voice dictation, and browser-driven self-verification.

## Evidence
- Changelog: [Expanded technical preview availability for the GitHub Copilot app](https://github.blog/changelog/2026-06-02-expanded-technical-preview-availability-for-the-github-copilot-app/)
- Docs: [Working with agent sessions in the GitHub Copilot app](https://docs.github.com/en/copilot/how-tos/github-copilot-app/agent-sessions)
- First-party details:
  - GitHub defines canvases as bidirectional work surfaces where users inspect and edit state, agents update the work object directly, and the app enforces allowed actions against the underlying runtime or artifact
  - GitHub explicitly calls out canvases over plans, pull requests, browser sessions, terminals, release checklists, migration boards, incidents, spreadsheets, dashboards, cloud consoles, and workflow state
  - the current app release adds cloud sessions, cloud automations, Copilot CLI session continuity in the `My work` view, built-in `Rubber duck`, `/chronicle`, and agentic browsing that can click, type, and capture screenshots
  - app sessions can run in a new working tree, a local repository, or a cloud sandbox and expose explicit `Interactive`, `Plan`, and `Autopilot` modes plus model and reasoning-effort pickers
  - voice dictation uses an on-device transcription model instead of sending raw audio upstream
- Latest development checkpoint:
  - GitHub expanded the Copilot app technical preview on 2026-06-02 and paired that rollout with a much clearer product thesis around canvases as the place where agent progress becomes visible, steerable work

## Product signal
GitHub is converging on shared work objects instead of chat-only supervision. The app direction is toward agents updating structured surfaces that humans can inspect, redirect, and verify in place.
