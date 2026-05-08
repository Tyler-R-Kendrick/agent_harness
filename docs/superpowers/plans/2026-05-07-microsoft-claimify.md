# Microsoft Claimify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable browser-local Claimify-style factual claim extraction library that runs direct or through a Web Worker and can preload/cache a configurable Transformers.js text-generation model.

**Architecture:** Add a new strict TypeScript workspace package at `lib/claimify`. Keep model loading isolated in `model.ts`, deterministic extraction orchestration in `extractor.ts`, pure sentence/prompt/validation helpers in focused modules, and worker transport in `worker.ts` plus `worker-client.ts`.

**Tech Stack:** TypeScript ES modules, Vitest with V8 100% coverage, browser DOM/Web Worker APIs, and `@huggingface/transformers` v4 as a lazy-loaded peer/dev dependency.

---

## Feature Implementation Plan

1. Create `lib/claimify` as a workspace library following existing `lib/*` conventions.
2. Define the public API types, typed errors, and barrel exports.
3. Implement pure sentence splitting/excerpt construction and prompt builders first because they drive the model workflow contract.
4. Implement claim normalization, standalone validation, and exact/near duplicate removal.
5. Implement cache/model helpers with graceful guards around optional Transformers.js registry APIs and WebGPU-to-WASM fallback.
6. Implement `BrowserClaimExtractor` as the direct orchestration engine.
7. Implement worker message handling and a typed worker client with request IDs, progress routing, error mapping, and cleanup.
8. Add README examples and caveats.
9. Run package coverage, TypeScript, generated-file checks, and the required Agent Browser verifier.
10. Publish a PR with validation notes. No visual UI screenshot is expected because this is a non-UI library.

## Architecture-Aligned Technical Spec

### Files

- Create: `lib/claimify/package.json` - workspace package metadata, peer/dev deps, scripts.
- Create: `lib/claimify/tsconfig.json` - strict browser TypeScript config.
- Create: `lib/claimify/vitest.config.ts` - V8 coverage with 100% thresholds.
- Create: `lib/claimify/README.md` - direct usage, worker usage, offline/PWA notes, caveats.
- Create: `lib/claimify/src/types.ts` - public API, stage output schemas, diagnostics, worker messages.
- Create: `lib/claimify/src/errors.ts` - typed custom error hierarchy and serialization helpers.
- Create: `lib/claimify/src/sentence.ts` - `splitSentences`, `buildExcerpt`.
- Create: `lib/claimify/src/prompts.ts` - selection, disambiguation, decomposition prompt builders.
- Create: `lib/claimify/src/validation.ts` - claim normalization, validation, deduplication.
- Create: `lib/claimify/src/cache.ts` - optional model cache registry probes.
- Create: `lib/claimify/src/model.ts` - lazy Transformers.js import, pipeline loading, deterministic JSON generation.
- Create: `lib/claimify/src/extractor.ts` - `BrowserClaimExtractor`.
- Create: `lib/claimify/src/worker.ts` - browser worker request loop.
- Create: `lib/claimify/src/worker-client.ts` - typed worker-backed `ClaimExtractor`.
- Create: `lib/claimify/src/index.ts` - public exports.
- Create: `lib/claimify/src/__tests__/*.test.ts` - focused tests for each module.

### Behavioral Requirements

- Treat every extraction as a question-answer pair. The question must be included in every prompt.
- Split the answer into sentences with `Intl.Segmenter` when present and a conservative regex fallback otherwise.
- Mark the target sentence inside excerpts and include headings/source/generated timestamp metadata.
- Run selection, disambiguation, and decomposition as three strict JSON model calls.
- Drop unverifiable, ambiguous, malformed, duplicate, and non-standalone claims.
- Preserve attribution, conditions, timeframes, quantities, comparisons, locations, and important qualifiers.
- Support `strict`, `balanced`, and `recall` strictness with stricter validation in strict mode.
- Support cancellation at orchestration checkpoints with `AbortSignal`.
- Keep all Transformers.js access behind dynamic import so consumers can tree-shake and lazy-load model code.
- Prefer WebGPU for `device: "auto"` when available, fallback to WASM, and use quantized dtype by default.
- Use browser and WASM caches where Transformers.js exposes those flags.
- Worker messages must never expose internal stack traces by default.

## One-Shot LLM Prompt

You are implementing TK-31 in the `agent-harness` repository. Build a new workspace package at `lib/claimify` that implements a reusable browser-local Claimify-style factual claim extraction library.

Follow the repository's `lib/*` conventions: `package.json` with `"type": "module"`, `main/types/exports` pointing at `./src/index.ts`, strict `tsconfig.json`, `vitest.config.ts` with V8 coverage and 100% thresholds for lines, branches, functions, and statements, source under `src/`, tests under `src/__tests__/`, and `src/index.ts` excluded from coverage.

Implement the public API from TK-31 exactly: `ClaimExtractor`, `BrowserClaimExtractor`, `createClaimifyWorkerExtractor`, `ClaimExtractionInput`, `ClaimExtractionResult`, `ExtractedClaim`, `DroppedSentence`, `PreloadOptions`, and `PreloadResult`. Use `@huggingface/transformers` v4 as a peer dependency and dev dependency, but lazy-load it only inside `model.ts`.

Use TDD. First add failing tests for sentence splitting/excerpts, prompt JSON contracts, validation/deduplication, model JSON parsing/fallback behavior, extractor orchestration with a fake generator, and worker-client request routing. Then implement only enough code to pass. Maintain 100% coverage.

Do not add React UI or server-side code. Include README examples for direct usage, worker usage, offline/PWA preloading, and quality caveats that the implementation is not official Microsoft Claimify and does not judge truth.

## TDD Checklist

- [ ] **Step 1: Write failing package tests**

Add tests under `lib/claimify/src/__tests__/` that import the planned API modules and assert the expected behavior from this plan.

Run: `npm.cmd --workspace @agent-harness/claimify run test`

Expected: FAIL because the package and source modules are not implemented yet.

- [ ] **Step 2: Implement package shell and public types**

Create `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/types.ts`, `src/errors.ts`, and `src/index.ts`.

Run: `npm.cmd --workspace @agent-harness/claimify run test`

Expected: tests advance to failures in missing behavior modules.

- [ ] **Step 3: Implement pure helpers**

Implement `sentence.ts`, `prompts.ts`, and `validation.ts`.

Run: `npm.cmd --workspace @agent-harness/claimify run test`

Expected: pure helper tests pass.

- [ ] **Step 4: Implement model/cache/extractor**

Implement `cache.ts`, `model.ts`, and `extractor.ts` with fake-generator seams for tests.

Run: `npm.cmd --workspace @agent-harness/claimify run test:coverage`

Expected: package tests pass with 100% coverage.

- [ ] **Step 5: Implement worker transport**

Implement `worker.ts` and `worker-client.ts`.

Run: `npm.cmd --workspace @agent-harness/claimify run test:coverage`

Expected: package tests pass with 100% coverage.

- [ ] **Step 6: Document and verify repository**

Add `lib/claimify/README.md`, run generated-file checks, package coverage, TypeScript checks, and `npm.cmd run verify:agent-browser`.

Expected: all available local gates pass. If the Agent Browser visual smoke runs, use its generated screenshot as the only visual artifact; this task has no UI-specific screenshot.

## Self-Review

Spec coverage: The plan covers direct usage, worker usage, cache/offline readiness, Transformers.js lazy loading, three-stage prompting, sentence context, post-processing validation, diagnostics, cancellation, typed errors, README caveats, and strict package coverage.

Placeholder scan: No TBD/TODO placeholders are present.

Type consistency: File names, exported names, and strictness/device/dtype unions match the Linear issue API.
