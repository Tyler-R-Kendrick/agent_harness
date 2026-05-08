# llguidance WASM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-local `lib/llguidance-wasm` package that accepts local tokenizer JSON, creates constrained matcher sessions from guidance-style grammars, returns allowed token IDs, and advances parser state as tokens are committed.

**Architecture:** The repo does not contain a Rust `llguidance` workspace, so this implementation adds a TypeScript-first sub-library under `lib/llguidance-wasm` with the same public browser API the future WASM backend needs. The runtime keeps tokenizer IDs stable from the supplied Hugging Face `tokenizer.json`, normalizes grammar inputs into finite candidate strings for JSON schema/select/literal constraints, and drives one or more matcher handles over a reusable session.

**Tech Stack:** TypeScript ESM source exports, Vitest with v8 100% coverage thresholds, browser-safe DOM/WebWorker typings, and no Node-only runtime APIs.

---

## Feature Implementation Plan

1. Claim Linear TK-32 and move it to In Progress.
2. Create this plan/spec/prompt artifact.
3. Add `lib/llguidance-wasm` package scaffolding following repo library conventions.
4. Write failing tests for tokenizer loading, mask application, matcher lifecycle, grammar normalization, transformers integration, worker protocol, package boundary, and browser-safety guards.
5. Implement minimal production code to pass those tests.
6. Run focused package tests with coverage, repo generated-file checks, and `verify:agent-browser`.
7. Publish a branch and PR, attach verification evidence, link the PR in Linear, and move TK-32 to Done after merge/readiness is confirmed.

## Architecture-Aligned Technical Spec

`lib/llguidance-wasm` exports `initLlguidanceWasm`, `LlguidanceSession`, `TokenMaskApplier`, `applyAllowedTokenMaskInPlace`, `LlguidanceLogitsMasker`, worker install/client APIs, and TypeScript types. The package is named `@agent-harness/llguidance-wasm` to match first-party repo conventions while preserving the issue's API shape.

`LlguidanceSession` accepts Hugging Face-style tokenizer JSON and never remaps token IDs. Each matcher is a numeric handle derived from `json_schema`, `lark`, `regex`, or `serialized` grammar inputs. The TypeScript runtime normalizes finite grammar candidates, computes allowed next-token IDs, commits sampled tokens, exposes deterministic fast-forward tokens, and supports reset/free lifecycle operations.

The repo does not currently contain a Rust `llguidance` checkout, so the implementation keeps the WASM initialization boundary explicit and browser-safe for a later Rust backend. The current implementation has no Node-only runtime imports and runs offline in browser-compatible TypeScript.

## One-Shot LLM Prompt

Implement Linear TK-32 by creating `lib/llguidance-wasm` as a first-party ESM TypeScript package. Use strict TS, Vitest with v8 100% thresholds, and browser-safe DOM/WebWorker libs. Preserve the requested public API: initialize WASM, create sessions from local tokenizer JSON, create matcher handles from serialized/json_schema/lark/regex grammars, compute allowed-token masks, commit tokens, return fast-forward tokens, expose transformers-style logit masking helpers, and provide a worker protocol/client.

Because there is no Rust `llguidance` workspace in this repo, implement the stable TypeScript runtime and keep `initLlguidanceWasm()` as the future backend boundary. Use TDD: tests first for tokenizer IDs, grammar candidate extraction, matcher lifecycle, invalid-token errors, mask helpers, transformer helper, worker protocol, package exports, and browser safety. Validate with package coverage, TypeScript noEmit, emitted-JS smoke, generated-file checks, and `verify:agent-browser`.
