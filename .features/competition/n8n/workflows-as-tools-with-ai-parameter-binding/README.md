# Workflows As Tools With AI Parameter Binding

- Harness: n8n
- Sourced: 2026-05-10

## What it is
n8n lets agents call whole workflows as tools and lets the model fill workflow parameters directly through schema-bound fields.

## Evidence
- Official docs: [Call n8n Workflow Tool node](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolworkflow/)
- Official docs: [What's a tool in AI?](https://docs.n8n.io/advanced-ai/examples/understand-tools/)
- Official docs: [Call an API to fetch data](https://docs.n8n.io/advanced-ai/examples/api-workflow-tool/)
- First-party details:
  - the Call n8n Workflow Tool node can invoke a database-backed sub-workflow or inline workflow JSON
  - workflow inputs can be fixed, expression-driven, or delegated to the model through AI-populated fields
  - the `$fromAI()` function gives the model controlled influence over tool parameters instead of unrestricted prompt stuffing
  - n8n repeatedly uses workflow-as-tool composition to connect agents to APIs, Sheets, and fallback flows
- Latest development checkpoint:
  - the current docs still position workflow tools as a preferred pattern for exposing reusable operational logic to agents in 2026

## Product signal
n8n is collapsing the gap between orchestration graph and tool surface: a workflow is not just the thing that runs the agent, it is also a reusable tool the agent can call.
