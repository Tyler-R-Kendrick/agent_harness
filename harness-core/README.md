# harness-core

Reusable TypeScript agent-loop primitives for `agent_harness`.

The package follows the parts of Pi's agent core that are useful outside a TUI:
typed messages, lifecycle events, stateful queues, awaited subscribers, a
low-level loop runner, and an event-driven XState actor kernel that extension
packages can use to define orchestration workflows.

## Package boundary

Use the root entry point for stable core runtime APIs:

```ts
import { createAgentRuntime } from 'harness-core';
```

The package also defines the plugin manifest and marketplace manifest standards:

```ts
import { validateHarnessPluginManifest } from 'harness-core';
```

Deep imports from `harness-core/src/*` are internal implementation details.
Optional adapters such as AGENTS.md, agent-skills, and DESIGN.md ship as standalone plugins.
Consumers should use the root package export for core APIs and load optional
plugin packages through their manifests so internal module layout can change
without breaking package users.

The event-loop surface formulates a serializable workflow definition whose
states publish registered events. Registered actors handle those events, and
registered publishers receive the workflow, state, xstate snapshot, actor, and
dispatch lifecycle events. States can invoke actors serially or in parallel, and
actor context includes `parentActorId` plus `runSubagent()` so future extension
packages can layer subagent orchestration without changing the core loop.

## Storage-backed artifacts

`HarnessStorage` is a small async key-value abstraction for host-provided
persistence. `InMemoryHarnessStorage` is the default local adapter, and
`createHarnessStorageAdapter()` wraps host storage callbacks such as IndexedDB,
localStorage, or remote APIs. Artifact refs can either point at harness storage
or at a remote provider that owns the bytes:

```ts
import { ArtifactRegistry, InMemoryHarnessStorage } from 'harness-core';

const storage = new InMemoryHarnessStorage();
const artifacts = new ArtifactRegistry({ storage });

const draft = await artifacts.create({
  data: '# Draft',
  mediaType: 'text/markdown',
});

await artifacts.write(draft.id, { data: '# Final', mediaType: 'text/markdown' });
const current = await artifacts.read(draft);
```

`createAgentRuntime()` and `createHarnessExtensionContext()` expose shared
`storage` and `artifacts` components so parent agents, subagents, and plugins
can keep working against the same persistent artifact handle. Remote artifacts
are registered with a URI/provider and can be read or written through supplied
remote handlers without copying their contents into harness storage.

Storage can be supplied directly, through `HarnessStorageProvider`, or through a
factory function:

```ts
import { createAgentRuntime, createHarnessStorageAdapter } from 'harness-core';

const storage = createHarnessStorageAdapter({
  get: (key) => remoteStore.get(key),
  set: async (key, value, options) => remoteStore.put(key, value, options),
});

createAgentRuntime({
  storage: () => storage,
  agent,
});
```

## Default commands

`createDefaultCommandRegistry()` and `createHarnessExtensionContext()` include:

- `/help [command]` for command discovery.
- `/update` for a supplied harness update handler, or an unavailable status when none is configured.
- `/config [key|key=value]` for in-memory setting reads and writes.
- `/version` for the current `harness-core` version.
- `tool:<tool-name>(<param>=<value>, ...)` for direct invocation of registered tools.

The `/config` command accepts either the legacy `config` value map or a typed
`settings` registry. Setting definitions can describe built-in value types
(`string`, `number`, `integer`, `boolean`, `json`, and `enum`), defaults, and
descriptions so host apps can render settings without hard-coding the schema:

```ts
import { createDefaultCommandRegistry } from 'harness-core';

const commands = createDefaultCommandRegistry({
  settings: {
    definitions: [
      { key: 'theme', type: 'enum', values: ['light', 'dark'], defaultValue: 'dark' },
      { key: 'maxTurns', type: 'integer', defaultValue: 3 },
      { key: 'approvalRequired', type: 'boolean', defaultValue: false },
    ],
  },
});

await commands.execute('/config maxTurns=5');
```

Apps can register custom setting types when their UI stores a domain-specific
shape while the command should parse or format a friendlier value:

```ts
const commands = createDefaultCommandRegistry({
  settings: {
    types: [{
      id: 'percentage',
      parse: (value) => Number(value) / 100,
      format: (value) => `${Number(value) * 100}%`,
    }],
    definitions: [{ key: 'confidence', type: 'percentage', defaultValue: 0.75 }],
  },
});
```

## Plugin standards

The core package stays generic: workspace capability discovery recognizes
tools, hooks, plugins, and memory files. Product-specific instruction formats
are packaged outside `harness-core` as runtime-loaded plugin assets.

Plugin projects use `agent-harness.plugin.json` at the package root. Marketplace
catalogs use `agent-harness.marketplace.json` and point at plugin manifests
instead of source files. A manifest declares the plugin id, version, entrypoint,
capabilities, custom hook events, runtime assets, requested permissions, and
compatibility range.

```json
{
  "schemaVersion": 1,
  "id": "agent-harness.ext.example",
  "name": "Example plugin",
  "version": "0.1.0",
  "description": "Registers one optional harness feature.",
  "entrypoint": { "module": "./src/index.ts", "export": "createExamplePlugin" },
  "capabilities": [{ "kind": "hook", "id": "example" }],
  "events": [{ "type": "plugin", "name": "agent-harness.ext.example.before-run" }]
}
```

Custom events use the same hook-point mapping as built-in events. For example,
`createPluginHookPoint('agent-harness.ext.example', 'before-run')` resolves to
`plugin:agent-harness.ext.example.before-run`.

Plugins may also declare `renderers` and `paneItems`, or register them at
runtime through `context.renderers`. A renderer declares the media targets it
supports and may expose multiple implementations, including a WASI Preview 2
component declaration for portable renderers compiled from non-TypeScript
stacks. Hosts can use these contributions for file and artifact media such as
workflow canvases, PDF viewers, audio visualizers, and the DESIGN.md Designer
pane. External plugin bundles from GitHub Copilot CLI, Claude Code, and Pi can
be normalized with `importExternalPluginManifest` and
`importExternalPluginMarketplaceManifest` before installation.

## Optional constrained decoding

`harness-core` defines constrained-decoding requests that model providers and
workflow extensions can pass through their inference clients. For example,
`@agent-harness/logact-loop` can pass a JSON Schema constraint through its
driver client:

```ts
import { constrainToJsonSchema } from 'harness-core';
import { runLogActAgentLoop } from '@agent-harness/logact-loop';

await runLogActAgentLoop({
  inferenceClient,
  messages: [{ content: 'Return the next action.' }],
  constrainedDecoding: constrainToJsonSchema({
    type: 'object',
    properties: { action: { type: 'string' } },
    required: ['action'],
  }),
}, {});
```

Use `createGuidanceTsInferenceClient()` when the backing model is an
llguidance-compatible `guidance-ts` endpoint. The runtime dependency is part of
`harness-core`; constrained decoding stays optional per request. Calls without
`constrainedDecoding` are delegated to the fallback inference client, while
constrained calls go through the configured guidance server:

```ts
import {
  constrainToJsonSchema,
  createGuidanceTsInferenceClient,
} from 'harness-core';

const inferenceClient = createGuidanceTsInferenceClient({
  settings: {
    guidanceServerUrl: 'https://guidance.example/deployment/v1',
    apiKey: process.env.GUIDANCE_API_KEY,
  },
  fallback: unconstrainedInferenceClient,
});

await inferenceClient.infer(messages);
await inferenceClient.infer(messages, {
  constrainedDecoding: constrainToJsonSchema({
    type: 'object',
    properties: { action: { type: 'string' } },
    required: ['action'],
  }),
});
```

Constraints can target JSON Schema, Lark grammars, TOON, or Zod schemas. Zod
constraints default to JSON Schema conversion and can override the grammar with
Lark, TOON, or a serialized guidance grammar. TOON support is provided by the
`createToonGrammarPlugin()` extension plugin. The plugin registers deterministic
pipe hooks on the constrained output-production path: one hook resolves the
llguidance grammar before generation, and another decodes TOON text after
generation.

```ts
import {
  constrainToToon,
  createGuidanceTsInferenceClient,
  createHarnessExtensionContext,
  createToonGrammarPlugin,
} from 'harness-core';

const context = createHarnessExtensionContext();
await context.plugins.load(createToonGrammarPlugin());

const inferenceClient = createGuidanceTsInferenceClient({
  settings,
  fallback: unconstrainedInferenceClient,
  hooks: context.hooks,
});

await inferenceClient.infer(messages, {
  constrainedDecoding: constrainToToon(),
});
```

## Config-backed model providers

`harness-core` owns the custom provider catalog contract so apps can load model
providers from JSON, local storage, or any other runtime config source without
recompiling TypeScript.

```ts
import {
  createConfiguredModel,
  defineModelProviderCatalog,
} from 'harness-core';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const catalog = defineModelProviderCatalog({
  activeModel: 'lmstudio:qwen3',
  providers: [
    {
      id: 'lmstudio',
      kind: 'openai-compatible',
      baseURL: 'http://127.0.0.1:1234/v1',
      apiKeyEnvVar: 'LMSTUDIO_API_KEY',
      models: ['qwen3'],
    },
  ],
});

const model = createConfiguredModel(
  catalog,
  undefined,
  { openAICompatible: createOpenAICompatible },
  { getSecret: (name) => process.env[name] },
);
```

Provider refs use `provider:model` syntax, so model ids may still contain `/`.
`apiKeyEnvVar` and header values such as `Bearer ${env:OPENROUTER_API_KEY}` are
resolved by the host app through the supplied `getSecret` callback.
