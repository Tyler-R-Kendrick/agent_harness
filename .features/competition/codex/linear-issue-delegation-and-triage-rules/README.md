# Linear Issue Delegation And Triage Rules

- Harness: Codex
- Sourced: 2026-05-16

## What it is
Codex can be assigned directly to Linear issues, mentioned in comment threads, and auto-assigned through Linear triage rules, with issue activity reflecting cloud-task progress.

## Evidence
- Official docs: [Use Codex in Linear](https://developers.openai.com/codex/integrations/linear)
- First-party details:
  - teams can assign issues to Codex like a teammate or mention `@Codex` in comments
  - Codex creates a cloud task, replies with progress, and posts a completion summary back to the issue
  - users can pin a repo in comments and track execution through issue activity plus a task link
  - Codex picks an environment and repository based on Linear context and the configured repo map
  - Linear triage rules can automatically delegate matching issues to Codex
  - local Codex app, CLI, and IDE workflows can separately connect to Linear through the Linear MCP server
- Latest development checkpoint:
  - the current Linear integration is shifting from ad hoc mentions toward tracker-native delegation rules and environment selection

## Product signal
Codex is moving ticket intake into the harness control plane, where issue routing, execution context, and completion reporting are tightly linked.
