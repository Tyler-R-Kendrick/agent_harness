# @agent-harness/lean-browser

Reusable browser-local agentic validation utilities for host applications that already own their UI, model loading, and static Lean assets.

This package maps the Python `agentic_validation` workflow into a TypeScript library shape:

1. Generate a reasoning trace with a caller-provided local model adapter.
2. Critique steps and the full trace.
3. Formalize suitable claims into Lean propositions.
4. Check those claims through an explicitly created Lean browser server.
5. Repair failed regions.
6. Gate the answer as `hard_verified`, `soft_verified`, `corrected`, `unverified`, or `rejected`.

## Usage

```ts
import {
  BrowserLeanChecker,
  JsonPromptValidationModel,
  createLeanServer,
  runAgentBrowser,
  type TaskInput,
} from '@agent-harness/lean-browser';

const llm = new JsonPromptValidationModel(async (prompt) => {
  return hostLocalModelGenerateJson(prompt);
});

const leanServer = await createLeanServer({ baseUrl: '/lean' });
await leanServer.connect();

const result = await runAgentBrowser(task, {
  llm,
  leanChecker: new BrowserLeanChecker(leanServer),
});
```

The package never loads Lean, IndexedDB, workers, or models on import. Heavy resources are created only through explicit factory calls.

## Lean Assets

The host app should serve Lean browser assets from a static route, commonly:

```text
/lean/
  lean_js_wasm.js
  lean_js_wasm.wasm
  lean_js_js.js
  library.zip
  library.info.json
  library.olean_map.json
```

`public/lean` in this package is documentation and placeholder structure only. Large generated Lean assets are intentionally not committed here.

## Model Injection

The host app owns Transformers.js or any other browser-local generation stack. Implement `LocalValidationModel` directly for maximum control, or use `JsonPromptValidationModel` with a host-provided `TextGenerator`.

The JSON adapter requests one JSON object, strips embedded prose, retries once after invalid JSON, and falls back conservatively.

## Testing

Testing utilities are available from the testing subpath only:

```ts
import { FakeLeanChecker, StubValidationModel } from '@agent-harness/lean-browser/testing';
```

Run from the repo root:

```bash
npm --workspace @agent-harness/lean-browser run test
npm --workspace @agent-harness/lean-browser run test:coverage
npm --workspace @agent-harness/lean-browser run typecheck
npm --workspace @agent-harness/lean-browser run build
```

## Limits

- The initial theorem builder targets Lean core/Init, not full Mathlib.
- Browser Lean packaging is version-sensitive.
- `lean-client-js` is archived and should be treated as a reference or pinned vendored pattern.
- Formalization quality depends on the host-provided local model.
- `unknown` is a safe result when Lean assets, formalization, or checker execution cannot establish correctness.
