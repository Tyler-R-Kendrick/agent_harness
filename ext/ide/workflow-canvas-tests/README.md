# Workflow Canvas Tests

`@agent-harness/ext-workflow-canvas-tests` is the private test harness for the
Workflow Canvas extension.

It owns unit, coverage, visual, and Playwright checks that exercise the
installable `@agent-harness/ext-workflow-canvas` package without shipping those
test-only dependencies or fixtures in the extension package itself.

## Package Boundary

Do not publish this package. It is marked `private`, has a `prepack` guard that
fails any package dry-run, and intentionally has no `files` allowlist because it
is not a distribution artifact.

Use the extension package for runtime imports:

```ts
import { WorkflowCanvasRenderer } from '@agent-harness/ext-workflow-canvas';
```

Use this package only through its workspace scripts:

```powershell
npm.cmd --workspace @agent-harness/ext-workflow-canvas-tests run test:unit
npm.cmd --workspace @agent-harness/ext-workflow-canvas-tests run test:coverage
npm.cmd --workspace @agent-harness/ext-workflow-canvas-tests run test:e2e
```

The root scripts `npm.cmd run test:canvas` and `npm.cmd run visual:canvas`
delegate here for repeatable workflow-canvas validation.
