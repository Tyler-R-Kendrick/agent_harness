# GitHub Code Review And Fix Loops

- Harness: Codex
- Sourced: 2026-05-16

## What it is
Codex can act as a GitHub-native reviewer and follow-up fixer, using cloud tasks plus repository guidance from `AGENTS.md`.

## Evidence
- Official docs: [Codex code review in GitHub](https://developers.openai.com/codex/integrations/github)
- First-party details:
  - repositories can enable Codex code review in settings after Codex Cloud is configured
  - users request review with `@codex review`
  - automatic reviews can run on every new pull request without a manual comment
  - review output focuses on P0 and P1 issues so the signal stays concentrated on serious risks
  - repository-specific review guidance comes from `AGENTS.md`, with the closest file applying per changed file
  - users can follow up with commands like `@codex fix the P1 issue` or other `@codex` tasks on the PR
- Latest development checkpoint:
  - current first-party guidance makes Codex a looped reviewer/fixer in GitHub, not just a one-shot comment bot

## Product signal
Codex is pushing review automation toward policy-aware defect loops where review and remediation live in the same PR thread.
