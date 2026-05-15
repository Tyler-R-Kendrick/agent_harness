# ACP Editor Integration

- Harness: Hermes Agent
- Sourced: 2026-05-15

## What it is
Hermes can run as an ACP server so editors such as VS Code, Zed, and JetBrains can treat Hermes as an editor-native coding agent with tool activity, diffs, terminal output, approvals, and streamed responses.

## Evidence
- Official docs: [ACP Editor Integration](https://hermes-agent.nousresearch.com/docs/user-guide/features/acp/)
- Official release: [Hermes Agent v0.3.0](https://github.com/NousResearch/hermes-agent/blob/main/RELEASE_v0.3.0.md)
- First-party details:
  - ACP mode lets editors render chat messages, tool activity, file diffs, terminal commands, approval prompts, and streamed output chunks
  - Hermes uses a curated `hermes-acp` toolset for editor workflows, including file tools, terminal tools, browser tools, memory, todo, session search, skills, and delegation
  - ACP sessions bind the editor working directory to the Hermes task so file and terminal tools execute relative to the editor workspace
  - the v0.3.0 release explicitly added ACP server support for VS Code, Zed, and JetBrains with slash-command support
- Latest development checkpoint:
  - current docs still position ACP as a first-party editor backend, which means Hermes is deliberately spanning standalone, messaging, dashboard, and IDE execution surfaces

## Product signal
Hermes is turning its core runtime into a reusable agent backend for editor clients instead of forcing every surface to reimplement the harness loop.
