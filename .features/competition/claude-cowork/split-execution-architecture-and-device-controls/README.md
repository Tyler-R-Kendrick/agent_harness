# Split Execution Architecture And Device Controls

- Harness: Claude Cowork
- Refreshed: 2026-05-23

## What it is
Cowork uses two distinct execution planes on the user's device: a host-native agent loop for file, web, and local plugin actions, and a separate isolated VM for shell commands and generated code.

## Evidence
- Official docs: [Claude Cowork desktop architecture overview](https://support.claude.com/en/articles/14479288-claude-cowork-desktop-architecture-overview)
- Team docs: [Use Claude Cowork on Team and Enterprise plans](https://support.claude.com/en/articles/13455879-cowork-for-team-and-enterprise-plans)
- First-party details:
  - the agent loop runs natively on the device for conversation handling, file reads and writes in connected folders, web fetches, and local plugin MCP servers
  - code execution runs inside a dedicated Linux VM isolated by Apple Virtualization.framework on macOS or Hyper-V on Windows
  - the VM enforces its own network egress filtering, syscall restrictions, and per-session user isolation
  - if the VM cannot start, Cowork can continue using file and web tools while shell and code actions report the workspace as unavailable
  - Team and Enterprise admins can disable local MCP servers or desktop extension servers on managed devices through MDM keys
  - network egress policy is applied to new Cowork sessions and can be managed separately from browser-style tools such as web fetch and Claude in Chrome
- Latest development checkpoint:
  - this architecture and policy model is now documented directly in Anthropic's admin help, which is a stronger signal than the earlier "isolated VM" marketing shorthand

## Product signal
Anthropic is formalizing split-trust agent execution: lightweight host-native actions stay useful even when the code sandbox is unavailable, while riskier shell execution gets its own isolation and policy controls.
