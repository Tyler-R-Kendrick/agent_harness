# @agent-harness/claimify

Browser-local Claimify-style factual claim extraction for web apps, PWAs, and browser extensions.

This package is not the official Microsoft Claimify implementation and does not depend on any proprietary Microsoft library. It implements the core local method: selection, disambiguation, decomposition, and validation of standalone factual claims from a question-answer pair.

## Install

```sh
npm install @agent-harness/claimify @huggingface/transformers
```

`@huggingface/transformers` is a peer dependency and is lazy-loaded only when a model is preloaded.

## Direct Usage

```ts
import { BrowserClaimExtractor } from '@agent-harness/claimify';

const extractor = new BrowserClaimExtractor();
await extractor.preload({ device: 'auto', dtype: 'q4' });

const result = await extractor.extract({
  question: "What did the article say about Contoso's earnings?",
  answer: articleSummary,
  options: { strictness: 'strict' },
});

console.log(result.claims);
```

## Worker Usage

```ts
import { createClaimifyWorkerExtractor } from '@agent-harness/claimify/worker-client';

const worker = new Worker(new URL('@agent-harness/claimify/worker', import.meta.url), {
  type: 'module',
});

const extractor = createClaimifyWorkerExtractor(worker);
await extractor.preload({
  progressCallback(event) {
    console.log(event);
  },
});

const result = await extractor.extract({ question, answer });
```

## Package Boundary

Use `@agent-harness/claimify` as the stable root import for browser-local claim extraction APIs. Use `@agent-harness/claimify/worker-client` for the worker-backed adapter and `@agent-harness/claimify/worker` as the module worker entry point.

The `@agent-harness/claimify/src/*` files are private implementation modules. They are included in the package artifact so TypeScript-source consumers can load the exported entry points directly, but consumers should not deep-import those paths.

Published artifacts are intentionally runtime-only: `README.md`, `package.json`, and `src/**/*.ts` are included, while `src/__tests__/**` is excluded.

## Offline/PWA Notes

Ask users to preload the model while online. The extractor enables browser and WASM cache flags where Transformers.js exposes them, and `isReadyOffline()` reports cache readiness when the model registry can answer it.

For a PWA, cache the app shell with your service worker and let Transformers.js cache the model assets. Model files can be large, so show progress, storage expectations, and a clear offline-readiness state.

## Extraction Behavior

The extractor treats the input as a question-answer pair. It splits the answer into sentences, builds a local excerpt around each target sentence, then runs:

1. Selection: keep only specific, objectively verifiable factual content.
2. Disambiguation: drop unresolved referential or structural ambiguity.
3. Decomposition: produce standalone, checkable claims while preserving attribution and important qualifiers.
4. Validation: reject malformed, ambiguous, vague, duplicate, too-short, or too-long claims.

Use `strict` mode when high precision matters. Browser-local models may miss subtle ambiguity or produce incomplete claims. The output is not a truth judgment; it is candidate factual claims for downstream verification.
