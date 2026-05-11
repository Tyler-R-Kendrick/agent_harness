# Workflow Canvas Single-Pane Implementation Plan

## Research Refresh

### n8n

Official references:

- Editor UI and canvas screenshots: https://docs.n8n.io/courses/level-one/chapter-1/
- Create and run workflows: https://docs.n8n.io/workflows/create/
- Product feature inventory: https://n8n.io/features/

Observed product requirements:

- Canvas is the primary object, with dotted grid, zoom/fit/reset/tidy controls, add-node and sticky-note affordances, and an execute-workflow control.
- Nodes are added from a node panel or from an existing node connector.
- Node buttons expose execute, activate/deactivate, delete, and contextual actions.
- Builder loop is iterative: configure a node, execute a node or workflow, inspect output next to settings, replay previous data, then publish.
- Feature set needs triggers, app actions, HTTP/code nodes, expressions, merge/loop/filter, credentials, templates, executions/debugging, AI nodes, and production deployment controls.

User stories:

- As an automation builder, I can add a trigger, connect actions, test each step, and publish without leaving the canvas.
- As an operator, I can replay a failed execution and inspect node input/output next to configuration.
- As a production owner, I can keep credentials referenced rather than embedded in the workflow document.

### Higgsfield Canvas

Official reference:

- Canvas overview and screenshots: https://higgsfield.ai/canvas-intro

Observed product requirements:

- Canvas is a node-based infinite board for prompts, references, generated images/videos, and model outputs.
- Outputs from one model can route into another model node.
- Creative workflows need prompt, reference, image generation, video generation, upscale, background replacement, style transfer, campaign, and template nodes.
- Collaboration matters: share links, comments, simultaneous editing, autosaved versions, and reusable assets.
- Cost should be visible at generation-node level, with graph editing free and generation consuming credits.

User stories:

- As a creative operator, I can branch one input into several model nodes, compare outputs, and route the preferred result downstream.
- As a reviewer, I can comment on a node and rerun only the changed generation step.
- As a campaign producer, I can duplicate a template and swap product, character, palette, or prompt inputs.

### OpenAI Agent Builder

Official reference:

- Agent Builder guide: https://developers.openai.com/api/docs/guides/agent-builder

Observed product requirements:

- Builder is a visual canvas for multi-step agent workflows.
- It supports templates, drag/drop nodes, typed inputs/outputs, live-data preview runs, publishing/versioning, ChatKit or SDK deployment, and trace-based evaluation.
- Nodes should make data contracts visible so downstream steps receive expected properties.

User stories:

- As an agent builder, I can preview a run with live data and see each node execution.
- As an engineer, I can publish a versioned workflow and export/deploy code.
- As an evaluator, I can run graders against traces from the workflow.

### CNCF Serverless Workflow

Official references:

- CNCF project page: https://www.cncf.io/projects/serverless-workflow/
- Serverless Workflow 1.0.0 release: https://serverlessworkflow.io/blog/releases/release-100/

Observed product requirements:

- The portable artifact must remain Serverless Workflow `1.0.0`.
- The implementation should preserve task-based workflow definitions, event/listen triggers, service/function calls, retries, timeouts, scheduling, concurrency, and extensibility.
- Agent Harness can add a native canvas layer, but import/export and execution contracts should remain DSL-backed.

## Single-Pane Feature Plan

1. Node catalog
   - Status: implemented in the installable `@agent-harness/ext-workflow-canvas` renderer.
   - Scope: trigger, AI agent, HTTP/action, branch, human approval, and media generation rows.
   - Next: make catalog insertion create editable nodes in persisted artifacts.

2. Graph canvas
   - Status: implemented as a scrollable single-pane graph seeded from Serverless Workflow in the extension renderer.
   - Scope: typed edges, branch labels, selectable nodes, n8n replay marker, OpenAI typed-edge marker, Higgsfield branch marker.
   - Next: add pan/zoom/tidy controls and drag-to-position persistence.

3. Node inspector
   - Status: implemented for selected node input, output, execution policy, source parity, and generation cost in the extension renderer.
   - Scope: supports trigger, AI, transform, media, approval, branch, action, and revision nodes.
   - Next: edit node parameters and validate changes back into the DSL.

4. Execution replay
   - Status: implemented as deterministic local replay state in the extension renderer.
   - Scope: run/reset controls, per-node status lane, retry/timeout flags.
   - Next: connect to AgentBus/process logs and real per-node adapters.

5. Artifact save/export
   - Status: implemented with extension-owned workspace-file persistence at `workflow-canvas/campaign-launch.json`.
   - Scope: saves media type, canvas graph, Serverless Workflow JSON, research references, and feature plan.
   - Next: open saved artifacts directly from File/Artifact panels using the same renderer contribution.

6. Runtime adapters
   - Status: planned next implementation slice.
   - Scope: HTTP/OpenAPI, webhook, schedule, model, media generation, secrets, human approval, worker queue, and trace/eval adapters.

7. Collaboration/versioning
   - Status: planned next implementation slice.
   - Scope: comments, node-level review notes, autosaved versions, template duplication, and rerun-only-changed generation nodes.

## Installable Extension Slice

- `agent-harness.plugin.json` now points both the renderer implementation and main-pane item at `WorkflowCanvasRenderer`.
- The Agent Browser install path renders the extension export from `@agent-harness/ext-workflow-canvas`; the host no longer owns a workflow-canvas feature component.
- Package tests cover the renderer export, workbench interaction model, artifact save/replace path, and 100% coverage for the extension package.
- Visual smoke installs Workflow Canvas from the marketplace, opens its extension activity entry, verifies the plugin renderer marker, clicks graph/inspector/replay/save controls, and captures `output/playwright/agent-browser-workflow-canvas.png`.
