# Agent Networks And Supervisor Pattern

- Harness: Mastra
- Sourced: 2026-05-01

## What it is
Mastra treats multi-agent coordination as a first-class primitive through agent networks and a newer supervisor pattern, so one routing agent can delegate to tools, workflows, or other agents instead of forcing everything through one monolithic prompt.

## Evidence
- Official repo: [mastra-ai/mastra README](https://github.com/mastra-ai/mastra)
- Official docs: [Mastra Agents](https://mastra.ai/agents)
- Official blog: [The evolution of AgentNetwork](https://mastra.ai/blog/agent-network)
- Official releases: [mastra-ai/mastra releases](https://github.com/mastra-ai/mastra/releases)
- First-party details:
  - the README says Mastra supports agents plus a graph-based workflow engine with explicit `.parallel()` control flow
  - the agents product page says teams can "orchestrate agent networks" and combine agents with workflows for more reliable execution
  - the AgentNetwork blog says Mastra deprecated separate network classes in favor of an `.network()` primitive on `Agent` that reasons, routes, and delegates automatically
  - the February 26, 2026 release notes added a supervisor pattern for multi-agent coordination with delegation hooks, completion scoring, memory isolation, and tool approval propagation
- Latest development checkpoint:
  - as of the current docs and 2026 releases, Mastra is still pushing orchestration toward a structured supervisor model instead of a loose "agent calls agent" demo pattern

## Product signal
Mastra is betting that reliable agent systems need workflow-aware delegation and supervisor controls, not just bigger prompts with more tools attached.
