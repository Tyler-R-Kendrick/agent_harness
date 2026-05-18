# Searchable Chronicle And Cross-Session Debug Recall

- Harness: GitHub Copilot
- Sourced: 2026-05-18

## What it is
Copilot now keeps a searchable local history of agent work and persistent debug logs so users can ask what they worked on, which files changed, and how earlier runs behaved.

## Evidence
- Changelog: [GitHub Copilot in Visual Studio Code, April releases](https://github.blog/changelog/2026-05-06-github-copilot-in-visual-studio-code-april-releases/)
- GitHub documents:
  - the experimental `/chronicle` feature stores chat interactions in a local database
  - Chronicle can recall touched files, referenced pull requests, and prior work across sessions
  - the Agent Debug Log panel now persists logs locally for earlier runs
  - agent sessions are sortable and Copilot CLI session titles stay synced across surfaces

## Product signal
GitHub is treating searchable run history as a first-class agent primitive instead of leaving past context buried in transcripts.
