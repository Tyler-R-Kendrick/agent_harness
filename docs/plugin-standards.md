# Agent Harness Plugin Standards

Agent Harness plugins are runtime-loaded packages. The core runtime does not
ship product-specific instruction formats such as AGENTS.md, agent-skills, or
DESIGN.md. Those features live in optional plugin projects under `ext/`.

## Package layout

Each plugin package owns this shape:

```text
ext/<plugin-name>/
  agent-harness.plugin.json
  package.json
  README.md
  src/
    index.ts
    index.test.ts
  examples/
    ...
```

The root `package.json` workspaces do not include `ext/*`. This keeps examples
out of the project build while preserving them as installable runtime assets.

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
  "name": "Agent Harness extension examples",
  "publisher": { "id": "agent-harness", "name": "Agent Harness" },
  "plugins": [{
    "id": "agent-harness.ext.example",
    "name": "Example plugin",
    "version": "0.1.0",
    "description": "Registers one optional harness feature.",
    "manifest": "./example/agent-harness.plugin.json",
    "source": { "type": "local", "path": "./example" },
    "default": true
  }]
}
```

This mirrors marketplace-style discovery: the catalog describes what can be
installed, while the plugin manifest describes what will be loaded.
Plugins marked `default: true` are intended for hosts to preinstall in new
workspace state while still loading through the plugin system rather than as
compiled-in product panels.

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

- `ext/agent-skills`: optional `.agents/skills/*/SKILL.md` loader.
- `ext/agents-md`: optional `AGENTS.md` prompt-context loader.
- `ext/design-md`: optional `DESIGN.md` guidance and token tooling.
- `ext/symphony`: default `WORKFLOW.md` prompt-context loader with optional
  Symphony orchestration examples.
