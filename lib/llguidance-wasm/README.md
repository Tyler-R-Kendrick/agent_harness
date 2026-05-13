# @agent-harness/llguidance-wasm

Browser-local llguidance-compatible constrained decoding runtime.

This package provides a TypeScript fallback for constrained token masking in
browser runtimes. It accepts simple grammar inputs, builds matcher sessions over
a tokenizer JSON payload, and exposes both direct session APIs and Worker-safe
message handling for callers that want to keep masking work off the UI thread.

## Usage

Initialize the runtime before constructing a session:

```ts
import {
  LlguidanceSession,
  initLlguidanceWasm,
} from '@agent-harness/llguidance-wasm';

await initLlguidanceWasm();

const session = new LlguidanceSession(tokenizerJson);
const matcherId = session.createMatcher({
  kind: 'regex',
  regex: 'yes|no',
});

const allowedTokenIds = session.computeMask(matcherId);
const result = session.commitToken(matcherId, allowedTokenIds[0]);
```

For Worker-based execution, install the message handler in the Worker and use
the client from the dedicated subpath:

```ts
import { installLlguidanceWorker } from '@agent-harness/llguidance-wasm/worker';
import { LlguidanceWorkerClient } from '@agent-harness/llguidance-wasm/worker-client';
```

## Package boundary

Use the package root for session, masking, and transformer integration APIs:

```ts
import { LlguidanceSession } from '@agent-harness/llguidance-wasm';
```

Use the documented subpaths only for Worker integration:

```ts
import { installLlguidanceWorker } from '@agent-harness/llguidance-wasm/worker';
import { LlguidanceWorkerClient } from '@agent-harness/llguidance-wasm/worker-client';
```

Treat `@agent-harness/llguidance-wasm/src/*` deep imports as private
implementation modules. They may change without a migration path.

Published package contents are limited to `README.md`, `package.json`, and
runtime `src/**/*.ts` files. Tests and package-local configuration are
development-only.

## Local development

Run focused package checks from the repository root:

```sh
npm --workspace @agent-harness/llguidance-wasm run test:coverage
npm --workspace @agent-harness/llguidance-wasm pack --dry-run
```

`vitest.config.ts` enforces 100% lines, branches, functions, and statements
coverage for the package source files.
