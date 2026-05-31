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

## Package Boundary

Use the package root for runtime imports:

```ts
import { WorkflowCanvasRenderer } from '@agent-harness/ext-workflow-canvas';
```

Use the manifest subpath for plugin discovery:

```ts
import manifest from '@agent-harness/ext-workflow-canvas/manifest';
```

Do not deep-import files under `src/`; those modules are implementation details
behind the root package API.

Published package contents intentionally include only `README.md`,
`agent-harness.plugin.json`, and runtime `src/**/*.ts` / `src/**/*.tsx` files.
Unit, visual, and Playwright checks live in the private
`@agent-harness/ext-workflow-canvas-tests` workspace so test fixtures and
browser-only dependencies do not ship with this extension.
