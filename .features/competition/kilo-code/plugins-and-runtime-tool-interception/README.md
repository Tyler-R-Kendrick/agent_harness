# Plugins And Runtime Tool Interception

- Harness: Kilo Code
- Sourced: 2026-05-07

## What it is
Kilo exposes a runtime plugin layer that can hook events, register providers, add tools, and even intercept or block tool calls before they execute.

## Evidence
- Official docs: [Plugins](https://kilo.ai/docs/automate/extending/plugins)
- Official marketplace repo: [Kilo Marketplace](https://github.com/Kilo-Org/kilo-marketplace)
- First-party details:
  - Kilo says plugins can add custom tools, intercept tool calls, rewrite arguments or outputs, and block dangerous operations
  - plugins can subscribe to sessions, messages, permissions, LSP diagnostics, and file-change events
  - plugins can register auth providers, model providers, custom compaction prompts, and shell environment variables
  - plugins load from config entries, plugin directories, or the `kilo plugin` command
  - the marketplace complements this with packaged modes, skills, and MCP servers
- Latest development checkpoint:
  - the current docs apply the plugin surface to both the VS Code extension and CLI, which means Kilo is standardizing runtime extensibility across local surfaces instead of making it editor-specific

## Product signal
Kilo is moving beyond static tool lists toward an interceptable runtime where teams can enforce policy and inject behavior at execution time.