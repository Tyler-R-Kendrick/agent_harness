# Desktop, CLI, API, And ACP Surfaces

- Harness: Goose
- Sourced: 2026-05-03

## What it is
Goose is explicitly positioned as a native cross-surface agent with desktop, CLI, API, and Agent Client Protocol entrypoints rather than a single chat shell.

## Evidence
- Official site: [goose home](https://goose-docs.ai/)
- Official docs: [Using goose in ACP Clients](https://goose-docs.ai/docs/guides/acp-clients/)
- Official docs: [ACP Providers](https://goose-docs.ai/docs/guides/acp-providers/)
- First-party details:
  - Goose markets itself as a desktop app, CLI, and API for code, workflows, and general automation.
  - Goose can run as an ACP server so editors like Zed and JetBrains can talk to it over stdio JSON-RPC.
  - Goose can also use ACP agents like Claude Code, Codex, and Gemini CLI as providers while passing Goose extensions through as MCP servers.
  - ACP client integrations preserve multiple concurrent conversations, model and mode switching, native file diffs, and terminal output inside the host editor.
- Latest development checkpoint:
  - the current docs frame ACP as both an integration surface and a provider bridge, which makes Goose more of an agent runtime fabric than a standalone client

## Product signal
Goose is competing on portability of the agent runtime itself. The same harness can sit behind its own desktop UI, terminal flows, editor panels, and third-party ACP clients.
