# Custom Agents As Subagents

- Harness: GitHub Copilot
- Sourced: 2026-05-05

## What it is
Copilot custom agents are Markdown-defined agent profiles that can be launched as subagents with separate context windows and parallel execution.

## Evidence
- Docs: [About custom agents](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-custom-agents)
- GitHub documents:
  - repository or org-level agent profile files under `.github/agents` or shared `agents/`
  - profiles that define prompt, tools, and MCP servers
  - built-in and custom agents running as subagents with separate context windows
  - parallel subagent execution for faster completion

## Product signal
GitHub is turning specialization into a composable orchestration primitive, not just a prompt preset.
