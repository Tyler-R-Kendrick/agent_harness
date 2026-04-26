# @agent-harness/webmcp

Spec-faithful WebMCP polyfill and registry runtime for browser-hosted agent tools, resources, prompts, and prompt templates.

## Public entry point

Import from the package root:

```ts
import {
  ModelContext,
  ModelContextClient,
  TOOL_ACTIVATED_EVENT,
  TOOL_CANCELED_EVENT,
  getModelContextPromptRegistry,
  getModelContextPromptTemplateRegistry,
  getModelContextRegistry,
  getModelContextResourceRegistry,
  installModelContext,
  invokeModelContextTool,
} from '@agent-harness/webmcp';
```

The package exports a single public entry point declared in [`package.json`](./package.json). Do not deep-import `src/*`; internal file paths are not a stable contract.

## What it provides

- `installModelContext(target?)`: installs a `navigator.modelContext` polyfill on a secure target window
- `ModelContext`: register tools, resources, prompts, and prompt templates
- `invokeModelContextTool(...)`: execute a registered tool with optional cancellation support
- `ModelContextClient`: pluggable user-interaction callback wrapper for tool execution
- Registry accessors: list, inspect, and subscribe to tools, resources, prompts, and prompt templates
- Tool lifecycle events: `toolactivated` and `toolcanceled`

`installModelContext` only installs into secure contexts: `https:` origins, loopback hosts such as `localhost`, or targets with `isSecureContext === true`.

## Minimal example

```ts
import {
  ModelContext,
  installModelContext,
  invokeModelContextTool,
} from '@agent-harness/webmcp';

const modelContext = installModelContext(window) ?? new ModelContext();

modelContext.registerTool({
  name: 'echo',
  description: 'Return the input unchanged.',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string' },
    },
    required: ['message'],
    additionalProperties: false,
  },
  async execute(input) {
    return input;
  },
});

const result = await invokeModelContextTool(modelContext, 'echo', { message: 'hello' });
```

Tool, prompt, and prompt-template names must match the package's ASCII name rule, and resource URIs must be valid absolute URIs.

## Registry access

Use the registry helpers to inspect or subscribe to changes:

```ts
import { getModelContextRegistry } from '@agent-harness/webmcp';

const tools = getModelContextRegistry(modelContext);
const unsubscribe = tools.subscribe((change) => {
  console.log(change.type, change.tool.name);
});

console.log(tools.list().map((tool) => tool.name));
unsubscribe();
```

## Local development

Run package checks from this directory:

```sh
npm run test
npm run test:coverage
```
