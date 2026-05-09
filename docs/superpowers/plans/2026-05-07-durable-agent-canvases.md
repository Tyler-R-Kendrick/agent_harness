# Agent Canvas Renderer Implementation Plan

**Status:** Supersedes the earlier durable sidebar-canvas plan.

**Goal:** Agent Canvas is the media-rendering extension contract for artifacts and generated media. It is not a sidebar panel. Plugin and extension packages declare the media types they support and the renderer implementations they ship; Agent Browser resolves the best renderer for a file or artifact at open time.

## Correct Architecture

Agent Browser treats generated files as media artifacts. A renderer is selected through the extension system in this order:

1. Installed extension renderers whose `target.mimeTypes` match the artifact file media type.
2. Built-in native browser renderers for media the browser already knows how to display.
3. A bounded chat session with the artifact attached, plus an optional raw source view.

The old `Canvases` sidebar, starter canvas artifacts, `agent-canvas:<kind>` artifact kinds, and canvas-specific prompt context are not part of the intended design.

## Plugin Contract

Renderer packages declare support in `agent-harness.plugin.json`:

```json
{
  "capabilities": [{ "kind": "renderer", "id": "workflow-canvas.renderer" }],
  "renderers": [{
    "id": "workflow-canvas.renderer",
    "label": "Workflow canvas",
    "target": {
      "kind": "file",
      "mimeTypes": ["application/vnd.agent-harness.workflow-canvas+json"]
    },
    "implementations": [{
      "id": "workflow-canvas.wasi",
      "runtime": "wasi-preview2",
      "module": "./dist/workflow-canvas-renderer.wasm",
      "wasi": {
        "world": "agent-harness:media-renderer/render@0.1.0",
        "wit": "./wit/media-renderer.wit"
      }
    }]
  }]
}
```

Renderer implementations may also provide React, web component, iframe, or native-browser entries. WASI Preview 2 component declarations are the portable path for renderers compiled from different language stacks.

## Agent Browser Defaults

The default native renderer catalog covers:

- `text/html`
- `image/svg+xml`
- `image/*`
- `audio/*`
- `video/*`
- `application/pdf`
- `text/*`
- `application/json`

Unsupported media opens to a bounded artifact chat affordance first. Raw source is still available, but it is a deliberate secondary view.

## Implementation Notes

- Core manifest validation accepts renderers with either a legacy `component` or one or more `implementations`.
- Extension runtime collection exposes installed manifest renderers to Agent Browser.
- `agent-browser/src/services/mediaRenderers.ts` owns renderer resolution and fallback selection.
- `ArtifactViewerPanel` renders native browser views, extension renderer placeholders, or bounded chat fallback states.
- The removed sidebar route is intentionally absent from persisted panel validation and shortcut order.

## Verification

Required checks for this feature:

- `npm.cmd --workspace harness-core run test -- src/__tests__/pluginManifest.test.ts -t "portable media renderer"`
- `npm.cmd --workspace agent-browser run test -- src/services/mediaRenderers.test.ts src/services/defaultExtensions.test.ts`
- `npm.cmd --workspace agent-browser run test:app -- -t "creates and opens"`
- `npm.cmd --workspace agent-browser run test:app -- -t "supports power-user panel"`
- `npm.cmd run verify:agent-browser`
- `npm.cmd run visual:agent-browser`
