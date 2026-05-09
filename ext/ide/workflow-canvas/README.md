# Workflow Canvas Orchestration

Workflow Canvas is an Agent Harness extension for workflow orchestration backed
by CNCF Serverless Workflow `1.0.0`.

It provides a headless foundation for an n8n-class automation builder and a
Higgsfield Canvas-style creative/media pipeline board:

- `workflow-canvas.inventory` returns researched feature parity targets and
  screenshot references.
- `workflow-canvas.validate` validates Serverless Workflow documents.
- `workflow-canvas.create` stores workflow canvas artifacts from Serverless
  Workflow JSON.
- `workflow-canvas.read` reads stored canvas artifacts.
- `workflow-canvas.export` exports stored canvases back to Serverless Workflow
  JSON.
- `/workflow <goal>` drafts a prompt for a new DSL-backed canvas.

The first slice is intentionally headless and testable. Its manifest now
declares the workflow canvas media type plus portable renderer implementations:
a WASI Preview 2 component entry for cross-language renderer packages and a
React fallback entry for the Agent Browser host.
