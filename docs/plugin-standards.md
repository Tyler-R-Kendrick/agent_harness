# Agent Harness Plugin Standards

Agent Harness plugins are runtime-loaded packages. The core runtime does not
ship product-specific instruction formats such as AGENTS.md, agent-skills, or
DESIGN.md. Those features live in optional plugin projects under `ext/`.

## Package layout

Each plugin package owns this shape:

```text
ext/<marketplace-category>/<plugin-name>/
  agent-harness.plugin.json
  package.json
  README.md
  src/
    index.ts
    index.test.ts
  examples/
    ...
```

The root `package.json` workspaces include `ext/*/*` so bundled extension
packages can live under marketplace categories while staying installable runtime
assets.

## Plugin manifest

Every plugin uses `agent-harness.plugin.json`:

```json
{
  "schemaVersion": 1,
  "id": "agent-harness.ext.example",
  "name": "Example plugin",
  "version": "0.1.0",
  "description": "Registers one optional harness feature.",
  "entrypoint": { "module": "./src/index.ts", "export": "createExamplePlugin" },
  "capabilities": [{ "kind": "hook", "id": "example" }],
  "events": [{ "type": "plugin", "name": "agent-harness.ext.example.before-run" }],
  "permissions": [{ "scope": "workspace-files", "access": "read", "reason": "Reads selected assets." }],
  "compatibility": { "harnessCore": "^0.1.0" }
}
```

Required fields are `schemaVersion`, `id`, `name`, `version`, `description`, and
`entrypoint.module`. Plugin ids use reverse-DNS lowercase segments. Entrypoints
must be relative paths inside the plugin package.

## Marketplace manifest

Marketplace catalogs use `agent-harness.marketplace.json` and point at plugin
manifests:

```json
{
  "schemaVersion": 1,
  "name": "Agent Harness default marketplace",
  "publisher": { "id": "agent-harness", "name": "Agent Harness" },
  "plugins": [{
    "id": "agent-harness.ext.example",
    "name": "Example plugin",
    "version": "0.1.0",
    "description": "Registers one optional harness feature.",
    "manifest": "./harness/example/agent-harness.plugin.json",
    "source": { "type": "local", "path": "./harness/example" },
    "default": true
  }]
}
```

This mirrors marketplace-style discovery: the catalog describes what can be
installed, while the plugin manifest describes what will be loaded.
Plugins marked `default: true` are intended for hosts to preinstall in new
workspace state while still loading through the plugin system rather than as
compiled-in product panels.

## Channel contributions

Plugins may contribute chat channels for share-dialog delegation and
continuation flows. The built-in `WebRTC peer` channel stays available without a
plugin and uses QR-signaled WebRTC DataChannels. External channels declare their
transport and capabilities so Agent Browser can add them to the share options
and pass a structured handoff payload to the provider implementation:

```json
{
  "contributes": {
    "channels": [{
      "id": "slack",
      "label": "Slack",
      "kind": "slack",
      "capabilities": ["delegate", "continue", "notify", "handoff-link"],
      "description": "Delegate or continue an Agent Browser chat through a Slack bot.",
      "configuration": {
        "type": "object",
        "properties": {
          "workspaceId": { "type": "string" },
          "botUserId": { "type": "string" }
        }
      }
    }]
  },
  "capabilities": [{ "kind": "channel", "id": "slack" }]
}
```

Channel kinds are `webrtc`, `slack`, `telegram`, `sms`, `email`, `webhook`,
`discord`, `teams`, and `custom`. Channel capabilities are `delegate`,
`continue`, `notify`, `presence`, and `handoff-link`. External providers should
keep provider tokens in the host secret store and treat inbound channel messages
as untrusted until the plugin validates identity, session scope, and replay
state.

## Renderer and pane contributions

Plugins may contribute custom renderers and pane items, similar to editor
extension contribution points. A renderer declares which media target it can
handle and one or more compliant implementations the host can load. Legacy
single-component renderers are still accepted, but portable renderers should
prefer implementation entries:

```json
{
  "capabilities": [
    { "kind": "renderer", "id": "media.pdf" },
    { "kind": "pane-item", "id": "design-md.designer-pane" }
  ],
  "renderers": [{
    "id": "media.pdf",
    "label": "PDF viewer",
    "target": {
      "kind": "file",
      "fileExtensions": [".pdf"],
      "mimeTypes": ["application/pdf"]
    },
    "implementations": [{
      "id": "media.pdf.wasi",
      "runtime": "wasi-preview2",
      "module": "./dist/pdf-renderer.wasm",
      "wasi": {
        "world": "agent-harness:media-renderer/render@0.1.0",
        "wit": "./wit/media-renderer.wit"
      }
    }, {
      "id": "media.pdf.react",
      "runtime": "react",
      "component": { "module": "./src/PdfRenderer.tsx", "export": "PdfRenderer" }
    }]
  }],
  "paneItems": [{
    "id": "design-md.designer-pane",
    "label": "Designer",
    "rendererId": "design-md.designer",
    "preferredLocation": "side",
    "when": { "kind": "file", "fileNames": ["DESIGN.md"] },
    "component": { "module": "./src/DesignerPane.tsx", "export": "DesignerPane" }
  }]
}
```

Targets support `fileNames`, `fileExtensions`, `mimeTypes` including wildcards
such as `audio/*`, `artifactKinds`, `messageTypes`, and `workspaceItemTypes`.
Renderer implementation runtimes currently include `wasi-preview2`, `react`,
`web-component`, `iframe`, and host-provided `native-browser`. Runtime plugins
can also register renderers directly through `context.renderers`, which is
useful for programmatic contributions such as an audio visualizer or a generated
artifact viewer. When no installed renderer or native browser renderer matches,
Agent Browser opens the artifact in a bounded chat session and exposes raw
source as an optional secondary view.

## External plugin formats

Agent Harness can import plugin manifests from adjacent agent ecosystems into
the same manifest model:

- GitHub Copilot CLI plugins: `plugin.json` from `.plugin/`, the repository
  root, `.github/plugin/`, or `.claude-plugin/`; components include agents,
  skills, commands, hooks, MCP servers, and LSP servers. Marketplace manifests
  can come from `marketplace.json`, `.plugin/marketplace.json`,
  `.github/plugin/marketplace.json`, or `.claude-plugin/marketplace.json`.
- Claude Code plugins: `.claude-plugin/plugin.json` plus conventional root
  component directories for skills, commands, agents, output styles, themes,
  monitors, hooks, MCP servers, LSP servers, `bin/`, and `settings.json`.
  Marketplace sources support relative paths, GitHub repos, git URLs,
  git-subdir entries, npm packages, refs, SHAs, and strict mode.
- Pi packages: `package.json` with a `pi` manifest, or conventional
  `extensions/`, `skills/`, `prompts/`, and `themes/` directories. Pi extension
  packages are treated as runtime extensions and renderer-capable because Pi
  extensions can register custom UI and message renderers.

Use `importExternalPluginManifest` and
`importExternalPluginMarketplaceManifest` from `harness-core` to normalize those
formats before presenting them to a host installer or loader.

## Events and hooks

Plugins may define custom events with `type: "plugin"`. Hosts should derive hook
points with `createPluginHookPoint(pluginId, eventName)`, which maps:

```ts
createPluginHookPoint('agent-harness.ext.example', 'before-run');
// plugin:agent-harness.ext.example.before-run
```

Built-in hook events stay in `harness-core`; plugin events are namespaced by the
plugin id to avoid collisions.

## Current example plugins

- `ext/harness/agent-skills`: optional `.agents/skills/*/SKILL.md` loader.
- `ext/harness/agents-md`: optional `AGENTS.md` prompt-context loader.
- `ext/ide/design-md`: optional `DESIGN.md` guidance and token tooling.
