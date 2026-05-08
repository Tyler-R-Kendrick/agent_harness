# Lean4WASM Browser Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `lib/lean-browser`, a reusable TypeScript browser library for local agentic validation with injected LLM adapters and explicit Lean 4 browser checking.

**Architecture:** The package follows existing `lib/*` conventions: TypeScript source is exported directly from `src/index.ts`, tests live under `src/__tests__`, and Vitest enforces 100% coverage. Lean, model loading, IndexedDB, and worker startup are explicit factory calls; importing the package only loads types and pure functions.

**Tech Stack:** TypeScript, Vitest, optional browser IndexedDB, explicit Lean worker abstraction, and host-provided text generation or `LocalValidationModel` adapters.

---

## Feature Implementation Plan

1. Claim `TK-33`, assign it, move it to In Progress, and keep Linear updated with implementation and verification evidence.
2. Create `lib/lean-browser` as a workspace library package, not an app, with package metadata, `tsconfig.json`, Vitest config, README, placeholder Lean asset documentation, and an importable example.
3. Port the validation data contract into `schemas.ts`: task inputs, reasoning traces, critique labels, checker results, formal claims, summary state, and agent results.
4. Add the model contract in `modules.ts`: `LocalValidationModel`, `TextGenerator`, and `JsonPromptValidationModel` that builds strict JSON prompts, parses conservative JSON, and never owns model loading.
5. Add Lean support as explicit adapters: theorem file builder, diagnostic normalization, server factory abstraction, and `BrowserLeanChecker` that returns `passed`, `failed`, or `unknown`.
6. Add deterministic orchestration: critique, formalization, checker attachment, repair loop, summary state, deterministic fallback gating, and artifact preservation.
7. Add optional persistence via `createArtifactStore`, with no storage opened on import and a memory fallback when IndexedDB is unavailable.
8. Add testing-only stubs under `src/testing` and export them only through `./testing`.
9. Validate with tests, typecheck/build, generated-file guard, and repo diff checks. Visual review does not apply because this issue explicitly forbids a standalone UI.

## Architecture-Aligned Technical Spec

### Package Boundary

`lib/lean-browser` is a self-contained library package. It exports source TypeScript directly, matching `@agent-harness/webmcp` and `@agent-harness/claimify`. It must not create an `index.html`, Vite app shell, React component, route, CLI, worker instance, Lean runtime, model instance, or IndexedDB database at import time.

### Public API

Main entrypoint `src/index.ts` exports:

- `schemas.ts`: all validation types and runtime schema-like validators.
- `modules.ts`: `LocalValidationModel`, `TextGenerator`, `JsonPromptValidationModel`.
- `prompts.ts`: strict JSON prompt builders.
- `json.ts`: first-object JSON extraction and validated parse helpers.
- `agent.ts`: `runAgentBrowser`.
- `gate.ts`: deterministic fallback gate.
- `summary.ts`: summary/failure helpers.
- `checkers/leanChecker.ts`: `BrowserLeanChecker`.
- `lean/*`: Lean server abstraction, theorem builder, diagnostic helpers, Lean types.
- `storage/artifactStore.ts`: optional artifact store.

Testing entrypoint `src/testing/index.ts` exports only fakes/stubs.

### Lean Contract

The host app serves Lean assets, normally at `/lean`. `createLeanServer()` only returns an explicit server object. `connect()` performs runtime checks and returns clear errors if assets or worker APIs are missing. `BrowserLeanChecker` catches these errors and maps them to `unknown`; Lean failures map to `failed`; zero error diagnostics map to `passed`.

### Agent Loop

`runAgentBrowser(task, { llm, leanChecker })` generates a trace, critiques steps, formalizes claims, checks Lean claims, marks accepted/failed statuses, repairs failing regions up to the configured limit, updates summary state, preserves checker artifacts, and gates the final answer. The deterministic gate prevents `hard_verified` unless all required Lean checks pass and no high-severity critique remains.

### TDD Checklist

- [ ] RED: theorem builder sanitizes IDs, renders explicit proof, fallback proof, assumptions, and ignores model imports.
- [ ] GREEN: implement `lean/theoremBuilder.ts`.
- [ ] RED: gate returns `hard_verified`, `corrected`, `unverified`, `rejected`, and `soft_verified` for the required cases.
- [ ] GREEN: implement `gate.ts` and needed schemas/types.
- [ ] RED: agent accepts passing traces, repairs Lean failures, never hard-verifies unknown checks, and preserves artifacts.
- [ ] GREEN: implement `agent.ts`, `summary.ts`, checker abstractions, and testing fakes.
- [ ] RED/GREEN: add focused tests for JSON parsing, prompt adapter, diagnostics, checker, storage, and exports as needed for coverage.
- [ ] REFACTOR: keep modules pure, typed, and import-side-effect free.
- [ ] VERIFY: run `npm.cmd --workspace @agent-harness/lean-browser run test:coverage`, `typecheck`, `build`, generated-file guard, and diff check.

## One-Shot LLM Implementation Prompt

Implement Linear `TK-33 Lean4WASM` in `C:\Users\conta\.codex\worktrees\2676\agent-harness`.

Create a new workspace library at `lib/lean-browser` using the existing `lib/*` conventions. Do not build an app, route, React UI, CLI, or standalone executable. The deliverable is a reusable TypeScript/browser library that lets a host app inject a local validation model or text generator, explicitly create a Lean browser server, run Lean checks on virtual theorem files, orchestrate critique/formalization/repair/gating, and optionally persist artifacts.

Follow TDD. Write failing Vitest tests first for theorem building, deterministic gating, and the agent repair/checking loop. Then implement the minimum production code to pass, add coverage for JSON/prompt/checker/storage/export behavior, and keep 100% coverage thresholds.

Required files include `package.json`, `tsconfig.json`, `vitest.config.ts`, `README.md`, `src/index.ts`, `src/schemas.ts`, `src/modules.ts`, `src/prompts.ts`, `src/json.ts`, `src/agent.ts`, `src/gate.ts`, `src/summary.ts`, `src/repair.ts`, `src/checkers/leanChecker.ts`, `src/lean/createLeanServer.ts`, `src/lean/leanTypes.ts`, `src/lean/theoremBuilder.ts`, `src/lean/diagnostics.ts`, `src/storage/artifactStore.ts`, `src/testing/stubValidationModel.ts`, `src/testing/fakeLeanChecker.ts`, `src/testing/index.ts`, `public/lean/README.md`, `public/lean/.gitkeep`, and `examples/minimal-browser-usage.ts`.

Keep startup explicit. Importing the package must not load Lean, models, workers, or storage. Testing fakes must be exported only from `./testing`. Document that the host app owns Lean assets, UI, and model loading. Use `unknown` rather than `passed` when Lean assets or formalization are unavailable.
