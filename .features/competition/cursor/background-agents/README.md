# Background Agents

- Harness: Cursor
- Sourced: 2026-05-01

## What it is
Cursor background agents are asynchronous remote coding agents that run in isolated environments, keep working while the human is away, and can be resumed, steered, or taken over later.

## Evidence
- Official docs: [Background Agents](https://docs.cursor.com/en/background-agents)
- Official changelog: [Bugbot, Background Agent access to everyone, and one-click MCP install](https://cursor.com/changelog/1-0)
- First-party details:
  - Cursor documents background agents as asynchronous agents that edit and run code in a remote environment
  - the docs describe a dedicated sidebar for searching, launching, and monitoring agents associated with the account
  - the 2025 `1.0` release made Background Agent generally available and positioned it as a first-class remote coding mode rather than a small beta add-on
  - the current product surface continues to connect background execution to follow-ups, takeover, and durable run management
- Latest development checkpoint:
  - as of the current Cursor docs and changelog, Background Agent remains a core control plane that newer features like web/mobile handoff, self-hosted workers, and SDK-triggered runs build on top of

## Product signal
Cursor treats asynchronous remote execution as a default part of the coding workflow, which keeps shifting the category away from foreground chat and toward durable agent operations.
