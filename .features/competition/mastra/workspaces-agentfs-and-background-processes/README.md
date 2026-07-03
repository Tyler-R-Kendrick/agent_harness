# Workspaces Agentfs And Background Processes

- Harness: Mastra
- Sourced: 2026-06-04

## What it is
Mastra gives agents controlled workspaces with filesystem, command execution, search, and skills, then extends that model with persistent AgentFS storage and explicit background-process management.

## Evidence
- Official blog: [Announcing Workspaces](https://mastra.ai/blog/announcing-mastra-workspaces)
- Official releases: [mastra-ai/mastra releases](https://github.com/mastra-ai/mastra/releases)
- First-party details:
  - the Workspaces announcement says a workspace can provide filesystem access, command execution, search, and reusable skills with fine-grained permission control
  - the February 24, 2026 release notes added background process management, including long-running command handles and process output retrieval
  - the March 13, 2026 release notes added `@mastra/agentfs`, a persistent Turso or SQLite-backed workspace filesystem for cross-session storage
  - the March 4, 2026 release notes expanded sandbox and workspace capabilities with token-aware output handling, cancellation, mounts, and configurable LSP resolution
  - the June 4, 2026 release notes say `Workspace.sandbox` can now be a resolver function so one workspace can route each request into an isolated sandbox with its own working directory or permissions
  - the same release adds `sandboxCacheKey` so background-process tools can keep talking to the same request-scoped sandbox across later turns and resumed work
- Latest development checkpoint:
  - recent releases show Mastra moving from simple tool calls toward a more complete, stateful execution environment for agents, including request-scoped isolation and explicit continuity for long-running process work

## Product signal
Mastra is treating the workspace as a governed runtime with durable state, request-scoped isolation, and process supervision, which is exactly the direction harnesses take once they stop being chat wrappers.
