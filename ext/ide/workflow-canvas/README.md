# Workflow Canvas Orchestration

Workflow Canvas is an Agent Harness extension for workflow orchestration backed
by CNCF Serverless Workflow `1.0.0`.

It provides an installable n8n-class automation builder and a Higgsfield
Canvas-style creative/media pipeline board:

- `workflow-canvas.inventory` returns researched feature parity targets and
  screenshot references.
- `workflow-canvas.validate` validates Serverless Workflow documents.
- `workflow-canvas.bindings` resolves expression bindings between nodes and
  previews pinned input data.
- `workflow-canvas.integrations` checks adapter readiness, credential
  references, and setup gaps before execution.
- `workflow-canvas.run` executes a deterministic local replay, records node
  inputs/outputs, and stores a workflow run artifact.
- `workflow-canvas.create` stores workflow canvas artifacts from Serverless
  Workflow JSON.
- `workflow-canvas.read` reads stored canvas artifacts.
- `workflow-canvas.export` exports stored canvases back to Serverless Workflow
  JSON.
- `/workflow <goal>` drafts a prompt for a new DSL-backed canvas.
- `WorkflowCanvasRenderer` renders the installed main-pane builder with node
  catalog, graph canvas, inspector, replay controls, binding maps, integration
  readiness, research references, and workspace artifact save support.

The manifest declares the workflow canvas media type plus portable renderer
implementations: a WASI Preview 2 component entry for cross-language renderer
packages and a React workbench entry for the Agent Browser host.
