# Multi-Agent Workspaces And Routing

- Harness: OpenClaw
- Sourced: 2026-05-20

## What it is
OpenClaw runs multiple isolated agents side by side, each with its own workspace, auth state, session store, and tool or sandbox policy, while routing inbound messages to the right agent through bindings.

## Evidence
- Official docs: [Multi-Agent Routing](https://docs.openclaw.ai/concepts/multi-agent)
- Official docs: [agents CLI](https://docs.openclaw.ai/cli/agents)
- First-party details:
  - each agent gets its own workspace, `agentDir`, and session store under `~/.openclaw/agents/<agentId>/sessions`
  - auth profiles are per-agent, and the docs explicitly warn against reusing `agentDir` across agents because it causes auth and session collisions
  - `openclaw agents add`, `bind`, `unbind`, `list --bindings`, and `set-identity` are first-party CLI flows for creating and routing agents
  - the routing model supports multiple channel accounts and peer-specific bindings so one gateway can host multiple isolated assistants
  - per-agent sandbox and tool configuration is documented, including different allow and deny policies per agent
- Latest development checkpoint:
  - the current docs emphasize not just separate personas, but separate auth, storage, sandboxing, and routing boundaries, which makes OpenClaw's multi-agent story materially stronger than the earlier lightweight notes captured

## Product signal
OpenClaw treats “multi-agent” as a systems concern, not just a prompt trick. Isolation boundaries, routing rules, and per-agent policy are all first-class parts of the harness.
