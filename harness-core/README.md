# harness-core

Reusable TypeScript agent-loop primitives for `agent_harness`.

The package follows the parts of Pi's agent core that are useful outside a TUI:
typed messages, lifecycle events, stateful queues, awaited subscribers, a
low-level loop runner, and an XState-backed LogAct workflow used by Agent
Browser.

The workflow surface formulates a serializable machine definition whose named
actors cover the driver, voters, decider, executor, and completion checker.
`WorkflowAgentBus` is the local write-ahead bus wrapper for the XState workflow
event stream and records `ActorMessageEvent` entries with session and actor
metadata. The first implementation is local-session only, with the public bus
and session types shaped for shared or remote stores later.

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

## Extension adapters

The core package stays generic: workspace capability discovery recognizes
tools, hooks, plugins, and memory files. Product-specific instruction formats
live under `harness-core/ext`.

- `harness-core/ext/agent-skills` maps `.agents/skills/*/SKILL.md` files into
  executable tools plus a `/skill <name> [input]` command backed by a supplied
  agent-skills client.
- `harness-core/ext/agents-md` maps `AGENTS.md` files into a hook plugin that
  prepends the active workspace instructions before model inference.

## Optional constrained decoding

`harness-core` can pass optional constrained-decoding requests through the
LogAct driver inference client:

```ts
import { constrainToJsonSchema, runLogActAgentLoop } from 'harness-core';

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
Lark, TOON, or a serialized guidance grammar. TOON support is built by
`buildToonGrammar()`/`buildToonLlGuidanceGrammar()`, which load the
`@toon-format/toon` package surface and expose a reusable Lark grammar
representation for llguidance.

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
