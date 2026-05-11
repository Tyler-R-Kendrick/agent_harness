# Symphony Workflow Orchestration

This runtime extension loads `WORKFLOW.md` files as Symphony orchestration guidance and keeps the Symphony board model outside the Agent Browser build.

The board surface under `examples/agent-browser-symphony/` is preserved as an example asset. Hosts can load the plugin through `agent-harness.plugin.json` and decide how, or whether, to render that example UI.

```ts
import { createSymphonyPlugin } from '@agent-harness/ext-symphony';
import { createDefaultSymphonyBoardState } from '@agent-harness/ext-symphony/board';
import manifest from '@agent-harness/ext-symphony/manifest';
```

## Package boundary

Use `@agent-harness/ext-symphony` for the runtime plugin, WORKFLOW.md helpers, and durable task orchestration APIs re-exported from `@agent-harness/task-manager` and `@agent-harness/workgraph`. Use `@agent-harness/ext-symphony/board` for the board model and reducer-style task helpers. Use `@agent-harness/ext-symphony/manifest` when a host needs plugin metadata.

Do not deep-import files under `src/`; those modules are implementation details packaged only so TypeScript-source consumers can load the documented entry points. Published artifacts are limited to this README, `agent-harness.plugin.json`, runtime TypeScript source, and example assets.
