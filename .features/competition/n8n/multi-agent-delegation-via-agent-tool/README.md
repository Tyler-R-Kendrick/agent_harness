# Multi-Agent Delegation Via Agent Tool

- Harness: n8n
- Sourced: 2026-05-10

## What it is
The AI Agent Tool node lets one root agent call other specialized agents as tools, including multi-tier delegation trees.

## Evidence
- Official docs: [AI Agent Tool node](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolaiagent/)
- Official blog: [Multi-agent system: Frameworks & step-by-step tutorial](https://blog.n8n.io/multi-agent-systems/)
- First-party details:
  - n8n says a primary agent can supervise and delegate work to AI Agent Tool nodes with narrower scopes
  - the docs explicitly allow multiple layers of nested agent tools for more complex multi-tiered use cases
  - delegated agents can require a specific output format and can attach a fallback model
  - batch-processing controls let teams rate-limit parallel delegated work
- Latest development checkpoint:
  - n8n's December 22, 2025 multi-agent guide positions visual multi-agent systems as a first-class pattern rather than a one-off example

## Product signal
n8n treats subagents as workflow primitives, which lowers the barrier to orchestrated agent teams for non-IDE users.
