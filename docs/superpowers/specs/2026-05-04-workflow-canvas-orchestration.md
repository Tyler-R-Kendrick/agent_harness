# Workflow Canvas Orchestration Research And Design

## Goal

Build a general workflow orchestration extension that uses CNCF Serverless Workflow as the portable DSL, appears in the Agent Harness extension marketplace, and provides the foundation for an n8n-class automation canvas plus Higgsfield Canvas-style creative/media pipelines.

## Researched Products

### CNCF Serverless Workflow

Serverless Workflow is the CNCF-owned portable DSL target. The CNCF project page describes it as the official specification for a Serverless Workflow Domain Specific Language, with standards for defining, executing, and managing workflows across serverless environments. The project was accepted into CNCF Sandbox on July 14, 2020.

The current ecosystem describes the DSL as vendor-neutral and community-driven. Important capabilities for this project:

- Declarative JSON/YAML workflow documents.
- Task-based orchestration with data context.
- Event-driven workflows with CloudEvents.
- Service and function calls over HTTP, gRPC, OpenAPI, AsyncAPI, and FaaS-style targets.
- Scheduling, retries, timeouts, error handling, conditional branches, and loops.
- Runtime portability across engines such as Apache EventMesh Workflow, SonataFlow, Lemline, Synapse, and Zigflow.

Design decision: Agent Harness should store the visual canvas as our native graph, but use Serverless Workflow `1.0.0` as the import/export and execution-contract layer.

### n8n

Representative screenshots:

- Blank workflow canvas: https://docs.n8n.io/_images/courses/level-one/chapter-one/l1-c1-canvas.png
- Completed tutorial workflow: https://docs.n8n.io/_images/try-it-out/tutorial-first.png
- AI nodes example: https://n8niostorageaccount.blob.core.windows.net/n8nio-strapi-blobs-stage/assets/ai_nodes_4a8d75e57c.webp

Feature inventory:

- Visual dotted-grid workflow canvas with zoom, tidy, add-node, sticky-note, execute-workflow, and AI assistant affordances.
- Workflow top bar with name, tags, publish/activation, share, save, and history.
- Node catalog for triggers, app/action nodes, core/flow nodes, data transform, AI nodes, and human-in-the-loop nodes.
- Drag/drop and connector-based node creation.
- Per-node detail editor with credentials, parameters, expressions, input/output preview, and manual step execution.
- Triggers: manual, schedule, webhook, app event, chat, event stream, and nested workflow triggers.
- Expressions and code nodes for transformations.
- Credentials store, variables, projects, roles, sharing, and team scoping.
- Templates and reusable workflows.
- Executions list with status filters, saved custom data filters, failed-run retry, and loading previous execution data back into the editor.
- Debugging with per-node input/output and inline logs.
- Queue mode using main process, Redis, workers, and database persistence for scale.
- AI agent workflows with chat trigger, model, memory, tools, output parser, human approval, and approval channels such as Slack, Teams, Gmail, Telegram, WhatsApp, and built-in chat.

Core user flows:

1. Create from scratch: open Workflows, create workflow, add first trigger node, configure it, connect action nodes, test, save, publish.
2. Build from template: browse templates, install/import, fill credentials, test, adapt, publish.
3. Debug a failure: open Executions, filter by failed status, inspect node outputs, load execution data into editor, edit, retry with original or current workflow.
4. Add credentials: choose node, create credential, store secret, verify connection, reuse credential in other workflows.
5. Build AI agent: add chat trigger, AI agent, model, memory, tools, optional human review, test chat path, publish.
6. Scale production: enable queue mode, configure Redis, start workers, control concurrency, keep execution data in a database.

### Higgsfield Canvas

Representative screenshots:

- Node-based composition: https://higgsfield.ai/cdn-cgi/image/fit%3Dscale-down%2Cformat%3Dwebp%2Conerror%3Dredirect%2Cwidth%3D1920%2Cquality%3D85/https%3A//static.higgsfield.ai/canvas/feature-1.png
- Multi-model picker in graph: https://higgsfield.ai/cdn-cgi/image/fit%3Dscale-down%2Cformat%3Dwebp%2Conerror%3Dredirect%2Cwidth%3D1920%2Cquality%3D85/https%3A//static.higgsfield.ai/canvas/feature-2.png
- Collaboration canvas: https://higgsfield.ai/cdn-cgi/image/fit%3Dscale-down%2Cformat%3Dwebp%2Conerror%3Dredirect%2Cwidth%3D1920%2Cquality%3D85/https%3A//static.higgsfield.ai/canvas/feature-3.png

Feature inventory:

- Infinite node-based workspace for prompts, images, references, and generated outputs.
- Drop a node, chain a flow, collaborate live.
- Prompts, references, and generations from multiple models on one board.
- Route outputs from one model node into another.
- Reusable templates for ad variants, character sheets, storyboards, and repeated pipelines.
- Collaboration links, simultaneous editing, attached comments, autosaved versions.
- Asset reuse for Soul ID characters, uploaded products, brand references, and previous generations.
- Model catalog with image and video generators such as Soul, Seedance, Kling, Wan, Veo, Nano Banana Pro, and GPT Image.
- Creative pipeline examples: VFX/background replacement, product and style fusion, model plus product campaigns, architecture timelapse, location/style transfer, logo animation, brand icon systems, and sketch-to-material variants.
- Credit model where graph editing is free and credits are consumed only when generation nodes run.

Core user flows:

1. Creative pipeline: drop prompt/reference/image, choose a model, connect output to image/video generation node, run node, review output.
2. Multi-model exploration: branch one input into several model nodes, compare outputs, route preferred output downstream.
3. Campaign generation: combine character, product, palette, and prompt into a campaign-ready image/video pipeline.
4. Team review: share canvas link, comment on nodes, revise prompt/model choices, rely on autosaved versions.
5. Reuse template: duplicate a saved pipeline, swap product or character input, rerun only generation nodes that need new output.

## Agent Harness Adaptation

The app already has the right extension seams:

- `ext/agent-harness.marketplace.json` lists installable marketplace entries.
- `agent-browser/src/services/defaultExtensions.ts` parses marketplace entries and loads default plugin packages.
- `harness-core` exposes plugins, tools, commands, artifacts, renderers, pane items, storage, and hooks.
- `ext/runtime/symphony` already proves a board model can live as a plugin asset, but it is task-board orchestration, not a general Serverless Workflow DSL or n8n-class workflow canvas.

The new extension should therefore be separate from Symphony:

- Package: `ext/ide/workflow-canvas`
- Marketplace id: `agent-harness.ext.workflow-canvas`
- Runtime plugin id: `workflow-canvas`
- Portable DSL: CNCF Serverless Workflow `dsl: "1.0.0"`
- Native model: an Agent Harness workflow canvas graph with nodes, edges, feature parity metadata, execution requirements, and source references.
- Stored artifact media type: `application/vnd.agent-harness.workflow-canvas+json`

## Product Surface

Initial usable extension capabilities:

- Validate a Serverless Workflow document.
- Convert a Serverless Workflow document into a canvas graph.
- Store a workflow canvas artifact.
- Read/export a workflow canvas artifact back to Serverless Workflow JSON.
- Expose the n8n and Higgsfield feature inventory as plugin data for the marketplace and future UI.
- Register a command that drafts an n8n-style workflow prompt using the Serverless Workflow DSL.

Future UI surface:

- Use the existing Agent Browser Extensions panel to show the installed extension.
- Add a pane-item contribution for a main workflow canvas.
- Reuse Agent Browser graph/process visual language where possible: compact cards, dense left catalog, right inspector, bottom execution log, and artifact-backed saved canvases.
- Keep the runtime model headless and testable; the UI should be a renderer over the graph and DSL model.

## Feature Parity Targets

Must match n8n:

- Trigger, action, flow, data, AI, code, credential, human review, execution/debug, template, project/share, and scaling concepts.
- Per-node test runs and full workflow runs.
- Previous-run replay and retry semantics.
- Secure credential references rather than embedded secrets.
- Subworkflow and webhook patterns.

Must match Higgsfield Canvas:

- Infinite graph mental model.
- Media-oriented node types for prompt, reference, asset, image generation, video generation, upscale, background replacement, style transfer, and campaign composition.
- Multi-model branches and output routing.
- Collaboration/comment/version model.
- Template duplication and rerun only changed generation nodes.
- Credit/cost estimate metadata per generation node.

Agent Harness-native additions:

- Serverless Workflow import/export.
- Artifact-backed workflow documents.
- AgentBus/process-log execution traces.
- Plugin marketplace installation and extension loading.
- Future MCP, secrets, browser, and shell nodes through existing harness tools and permissions.

## Implementation Slices

Slice 1, this change:

- Add a headless `workflow-canvas` extension.
- List it in the marketplace.
- Load it by default so the app can use it once installed.
- Provide tools for feature inventory, validation, create/store, read, and export.
- Add coverage for Serverless Workflow parsing, graph conversion, artifact persistence, command registration, and marketplace wiring.

Slice 2:

- Add an actual canvas pane-item renderer that can open saved workflow artifacts.
- Provide node catalog UI, inspector UI, and execution log UI.
- Add visual smoke screenshots for the installed extension and sample workflow.

Slice 3:

- Add executable adapters: HTTP/OpenAPI, webhook, schedule, human review, Agent Browser tool node, model node, image/video generation placeholder providers, and worker queue abstraction.
- Add execution replay, retry, and per-node output snapshots.

