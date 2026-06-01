# Design Studio

Optional Agent Harness plugin for Design Studio artifacts that compile interactive design-system work into `DESIGN.md` assets.

The plugin owns the DESIGN.md authoring loop: brief capture, direction selection, token review, aggregate composition sampling, per-section visual specimens, approval or needs-work revision decisions, generated preview artifacts, critique scoring, publish/default readiness, and export handoffs. Agent Browser renders the studio surface in the IDE extension pane and stores generated output as workspace artifacts.

## Package Boundary

Use the root package import for runtime helpers and plugin registration:

```ts
import { createDesignStudioPlugin } from '@agent-harness/ext-design-studio';
```

Use the manifest subpath when a host needs the extension descriptor:

```ts
import manifest from '@agent-harness/ext-design-studio/manifest';
```

Do not import from `@agent-harness/ext-design-studio/src/*`. Source files are private implementation details and may move without a compatibility shim.

## Published Package Contents

The published package includes `README.md`, `agent-harness.plugin.json`, and runtime TypeScript source under `src/**/*.ts`. Source tests and `src/__tests__/**` are excluded from the package artifact.
