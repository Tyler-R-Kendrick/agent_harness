# Granular Permission Policies

- Harness: OpenCode
- Sourced: 2026-04-27

## What it is
OpenCode exposes a policy layer where tool actions can be allowed, blocked, or routed through approval flows globally or per agent.

## Evidence
- Official docs: [Permissions](https://opencode.ai/docs/permissions/)
- Official docs: [Agents](https://opencode.ai/docs/agents/)
- First-party details:
  - permission outcomes are `allow`, `ask`, and `deny`
  - rules can be applied globally and overridden for specific tools or path patterns
  - command patterns like `git *`, `npm *`, and `rm *` can be treated differently
  - agent-specific permissions override global policy, so a planning agent can stay more restricted than a build agent

## Product signal
OpenCode turns safety and autonomy into a configurable product surface rather than a fixed global mode toggle.
