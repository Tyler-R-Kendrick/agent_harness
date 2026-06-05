# Design Studio

Optional Agent Harness IDE extension for Design Studio-style `DESIGN.md` projects.

This package turns a `DESIGN.md` file into an artifact-backed design-system studio with deterministic direction presets, token review and approval state, critique scoring, preview/export artifacts, and a command-driven prompt entrypoint for downstream agents.

## Install

```sh
npm install @agent-harness/ext-design-studio harness-core
```

`harness-core` is a peer dependency because hosts load the extension through the shared Agent Harness plugin contract.

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

## Host Integration

Load the plugin through the harness extension context:

```ts
import { createHarnessExtensionContext } from 'harness-core';
import { createDesignStudioPlugin } from '@agent-harness/ext-design-studio';

const context = createHarnessExtensionContext();
await context.plugins.load(createDesignStudioPlugin());
```

Once loaded, the extension contributes:

- The `design-studio.studio` renderer for `DESIGN.md` files
- The `design-studio.studio-pane` side pane item
- The `/designstudio` and `/design-studio` command aliases
- The `design-studio.inventory`, `design-studio.compile-design-md`, and `design-studio.critique` tools

The bundled plugin manifest also advertises the storage and workspace-file permissions the extension expects, plus the feature flag `agent-harness.extensions.agent-harness.ext.design-studio.enabled`.

## Artifact Flow

The runtime models the full studio loop:

1. Capture a project brief and source inventory.
2. Select one of the exported deterministic direction presets from `DESIGN_STUDIO_DIRECTIONS`.
3. Review token sections for type, color, spacing, components, and brand voice.
4. Approve or revise sections until the design system is ready to publish.
5. Compile `DESIGN.md`, critique the system, and export handoff artifacts.

`buildDesignStudioArtifactFiles(...)` emits the artifact bundle documented by the code and tests:

- `DESIGN.md`
- `research.json`
- `system.json`
- `token-review.json`
- `preview.html`
- `handoff.md`
- `critique.json` when a critique result is present

Use `createDesignStudioProjectArtifactInput(...)` when a host wants a ready-to-save artifact payload with a stable `design-studio-<slug>` identifier.

## Validation

Run:

```powershell
npm.cmd --workspace @agent-harness/ext-design-studio run test:coverage
```

The package enforces 100% statement, branch, function, and line coverage through `vitest.config.ts`.

## Published Package Contents

The published package includes `README.md`, `agent-harness.plugin.json`, and runtime TypeScript source under `src/**/*.ts`. Source tests and `src/__tests__/**` are excluded from the package artifact.
