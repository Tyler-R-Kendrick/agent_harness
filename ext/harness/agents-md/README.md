# AGENTS.md extension

Optional Agent Harness plugin for `AGENTS.md` workspace instruction assets.

`harness-core` no longer recognizes AGENTS.md by default. Hosts that want this
behavior load this package explicitly:

```ts
import { createAgentsMdHookPlugin } from '@agent-harness/ext-agents-md';

await context.plugins.load(createAgentsMdHookPlugin(files));
```

## Package Boundary

Use the package root for the stable plugin factory import:

```ts
import { createAgentsMdHookPlugin } from '@agent-harness/ext-agents-md';
```

Hosts that need plugin metadata should use the manifest export:

```ts
import manifest from '@agent-harness/ext-agents-md/manifest';
```

Do not deep-import files under `src/`; those modules are implementation details
for the root entry point.
