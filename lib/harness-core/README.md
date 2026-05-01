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

## Default commands

`createDefaultCommandRegistry()` and `createHarnessExtensionContext()` include:

- `/help [command]` for command discovery.
- `/update` for a supplied harness update handler, or an unavailable status when none is configured.
- `/config [key|key=value]` for in-memory setting reads and writes.
- `/version` for the current `harness-core` version.
- `tool:<tool-name>(<param>=<value>, ...)` for direct invocation of registered tools.

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
