# AGENTS.md extension

Optional Agent Harness plugin for `AGENTS.md` workspace instruction assets.

`harness-core` no longer recognizes AGENTS.md by default. Hosts that want this
behavior load this package explicitly:

```ts
import { createAgentsMdHookPlugin } from '@agent-harness/ext-agents-md';

await context.plugins.load(createAgentsMdHookPlugin(files));
```
