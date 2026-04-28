# inbrowser-use

Playwright-shaped DOM automation that runs inside the browser page being
controlled. The package is intended for in-app agents that need locator-style
queries, actionability checks, frame coordination, and lightweight automation
without launching an external browser controller.

## Install

`inbrowser-use` is a workspace TypeScript package. Consumers import the package
root directly:

```ts
import { createInAppPage } from 'inbrowser-use';

const page = createInAppPage();
await page.getByRole('button', { name: 'Save' }).click();
```

The package exports TypeScript source from `src/index.ts`; no bundler build step
is required for workspace consumers.

## Public API

Use the package root as the stable public entry point:

```ts
import {
  ActionabilityEngine,
  AgentRegistry,
  createInAppPage,
  InAppPage,
  TimeoutError,
} from 'inbrowser-use';
```

The root entry point exposes:

- `createInAppPage`
- Playwright-like page and locator types
- `Runtime`, `InAppPage`, `InAppLocator`, and `InAppFrameLocator`
- `ActionabilityEngine`, `ActionExecutor`, `QueryEngine`, and `StabilityManager`
- frame RPC helpers for cooperative frames
- registry and activation broker implementations
- package error classes

Deep imports into `src/*` are internal implementation details. Add new stable
exports through `src/index.ts` and protect them with a package-boundary test.

## Package Contents

The publish allowlist includes only:

- `README.md`
- runtime TypeScript files under `src/**/*.ts`

Tests, coverage output, local config, and generated artifacts are excluded from
the package artifact.

## Local Development

Run focused package checks from the repository root:

```sh
npm --workspace inbrowser-use run test:coverage
npm --workspace inbrowser-use pack --dry-run
```

Coverage is collected with Vitest and V8. Package-boundary tests live alongside
the runtime tests under `src/__tests__/`.
