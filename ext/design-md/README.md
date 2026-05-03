# DESIGN.md extension

Optional Agent Harness plugin for `DESIGN.md` design-token assets.

`harness-core` and Agent Browser no longer apply DESIGN.md behavior by default.
Hosts that want design-token guidance, CSS rendering, or constrained code
substitution load this package explicitly:

```ts
import { createDesignMdPlugin } from '@agent-harness/ext-design-md';

await context.plugins.load(createDesignMdPlugin({ documents }));
```
