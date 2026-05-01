# Bugbot Learned Rules And Autofix

- Harness: Cursor
- Sourced: 2026-05-01

## What it is
Cursor's Bugbot is a PR review agent that comments on pull requests, learns from reviewer feedback, can consume project-specific review rules, and now supports higher-confidence autofix flows.

## Evidence
- Official docs: [Bugbot](https://docs.cursor.com/bugbot)
- Official changelog: [Bugbot Learned Rules and MCP Support](https://cursor.com/changelog/04-08-26/)
- First-party details:
  - the Bugbot docs describe automatic reviews on PR updates plus manual trigger commands such as `cursor review` and `bugbot run`
  - Cursor uses `.cursor/BUGBOT.md` files so review context can be layered by directory as the bot traverses changed files
  - the April 8, 2026 changelog says Bugbot now learns from reactions, replies, and human-reviewer comments to create and promote learned rules
  - the same release says Bugbot Autofix uses only relevant rules, can apply multiple fixes with `Fix All`, and reached a reported 78 percent resolution rate
- Latest development checkpoint:
  - the April 8, 2026 release shows Cursor moving from static code review prompts toward self-improving review policy and actionability

## Product signal
Cursor is tightening the loop between PR review, organizational feedback, and automated repair, which is a powerful pattern for any harness that wants to own review-safe code changes instead of only draft generation.
