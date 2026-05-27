# Kimi Code CLI, VS Code, And Third-Party Agent Portability

- Harness: Kimi AI
- Sourced: 2026-05-27

## What it is
Kimi Code is Moonshot AI's coding harness for terminal-first and editor-based development, but it is also packaged as a portable subscription surface that can power third-party coding agents.

## Evidence
- Official docs: [Kimi Code Overview](https://www.kimi.com/code/docs/en/)
- Official help: [Kimi Code for VS Code quick start](https://www.kimi.com/help/kimi-code/vscode-getting-started)
- First-party details:
  - Kimi says Kimi Code provides code reading, file editing, and command execution through CLI and a VS Code extension
  - the official overview says members can also obtain an API key to use Kimi Code capabilities in third-party development tools and platforms
  - the docs explicitly call out compatibility with Kimi Code CLI, VS Code, Claude Code, and other development tools
  - the CLI uses `/login` for OAuth-based authentication and the VS Code extension uses a sidebar login flow instead of forcing manual API-key setup for official clients
  - the VS Code quick start says the extension supports diff views, rollback, `@` file references, `/` commands, and MCP server integrations
- Latest development checkpoint:
  - the current Kimi Code docs position the harness as both a first-party coding product and a portable entitlement layer for adjacent coding agents, which is stronger than the older "Kimi AI but for code" framing

## Product signal
Kimi is treating coding-agent access as an ecosystem surface: one subscription, multiple clients, and explicit portability into other harnesses.
