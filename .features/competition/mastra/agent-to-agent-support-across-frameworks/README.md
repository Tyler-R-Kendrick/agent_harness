# Agent-To-Agent Support Across Frameworks

- Harness: Mastra
- Sourced: 2026-05-29

## What it is
Mastra now supports A2A-style interoperability so agents can invoke or cooperate with other agents across framework boundaries instead of assuming every subagent lives inside one local harness stack.

## Evidence
- Official announcement: [Introducing Agent-to-Agent support for Mastra](https://mastra.ai/blog/introducing-agent-to-agent-support)
- Feature index: [Mastra features archive](https://mastra.ai/blog/category/features)
- Official releases: [mastra-ai/mastra releases](https://github.com/mastra-ai/mastra/releases)
- First-party details:
  - the feature archive lists A2A support as a May 19, 2026 feature focused on building cross-framework multi-agent systems
  - recent release notes say ACP-compatible coding agents can be used anywhere Mastra accepts a `SubAgent`, including supervisor delegation and workflow steps, which shows Mastra is broadening beyond same-runtime delegation
  - the wider orchestration surface already includes supervisor delegation, workflows, MCP, and channel ingress, so A2A support extends an existing coordination stack rather than introducing a standalone demo
- Latest development checkpoint:
  - May 2026 marks a shift from internal multi-agent coordination toward explicitly interoperable agent fabrics

## Product signal
Mastra is betting that serious harnesses need open multi-agent composition, not just nested local helpers. That broadens the competitive surface from "best built-in subagent" to "best coordinator across heterogeneous agent runtimes."
