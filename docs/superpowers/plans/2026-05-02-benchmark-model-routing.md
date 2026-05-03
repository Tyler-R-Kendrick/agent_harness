# Benchmark Model Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add benchmark-informed model routing to `agent-browser` so planning, browser action, verification, research, and review tasks can use auto-selected or pinned models with visible evidence.

**Architecture:** Keep routing and benchmark discovery as pure service logic under `agent-browser/src/services/benchmarkModelRouting.ts`, then integrate it into existing `ChatPanel` provider/model state and the settings sidebar. Persist user routing preferences and the most recent trusted benchmark evidence in local storage; static priors are fallback-only when runtime discovery cannot find reputable model-specific evidence.

**Tech Stack:** React 18, TypeScript, Vitest, existing `useStoredState`, existing GHCP/Codi model metadata, existing `verify:agent-browser` gate.

---

## Feature Implementation Plan

TK-46 asks for task classes, repeatable evaluation metadata with cost and latency, UI/runtime recommendation logic, and pin/auto workflows for planning, browser action, verification, and review. The implementable first slice is:

- Define task classes: `planning`, `browser-action`, `verification`, `research`, `review`.
- Define benchmark evidence fields: quality score, cost tier, latency tier, strengths, source label, source URL, retrieval time, and task-class metrics.
- Convert currently available GHCP and installed Codi models into routing candidates.
- On app startup, refresh benchmark evidence for the actual candidate set in the background:
  - Query Hugging Face model-card `model-index` eval results for installed Codi models.
  - Query configured trusted benchmark-index JSON endpoints for registered remote providers.
  - Ignore benchmark records whose source URL is not on the reputable-source allowlist.
  - Merge discovered scores into candidates before recommendations; keep fallback priors only for missing task classes.
- Recommend candidates by objective: balanced, quality, cost, or latency.
- Honor per-task pinned model refs before auto recommendations.
- Persist routing settings in local storage.
- Surface routing settings in Settings and current route evidence in the chat header.
- Apply routing during send: planner/researcher/debugger can auto-switch between GHCP and Codi runtime models; direct Codi/GHCP turns stay within compatible model-backed providers.

## Technical Spec

### Files

- Create `agent-browser/src/services/benchmarkModelRouting.ts`
  - Owns task-class definitions, fallback evidence catalog, runtime benchmark discovery, trusted-source filtering, discovered evidence merge, candidate construction, recommendation scoring, settings defaults, validators, and task inference.
- Create `agent-browser/src/services/benchmarkModelRouting.test.ts`
  - Covers objective scoring, pin handling, unavailable pins, task inference, candidate creation, settings validation, Hugging Face model-card discovery, trusted provider benchmark indexes, and untrusted source rejection.
- Modify `agent-browser/src/services/sessionState.ts`
  - Add `benchmarkModelRoutingSettings` and `benchmarkEvidenceState` localStorage keys.
- Modify `agent-browser/src/services/sessionState.test.ts`
  - Assert the storage key remains namespaced and documented.
- Modify `agent-browser/src/App.tsx`
  - Hydrate routing settings, pass them into `ChatPanel` and `SettingsPanel`, render settings controls, render current recommendation, and apply per-turn model refs.
- Modify `agent-browser/src/App.css`
  - Add compact routing-card styles that fit existing settings/header patterns.
- Add PR screenshot from `npm run visual:agent-browser` to `docs/superpowers/plans/2026-05-02-benchmark-model-routing-visual-smoke.png`.

### Runtime Behavior

- `buildBenchmarkRoutingCandidates()` combines:
  - GHCP models from `copilotState.models`, model refs `ghcp:<id>`.
  - Installed Codi models, model refs `codi:<id>`.
- `discoverBenchmarkEvidence()` runs in the background on app startup and whenever the candidate model set changes:
  - Fetches `https://huggingface.co/api/models/<model-id>` for installed Codi/HF models and parses model-card eval results.
  - Fetches optional benchmark-index URLs from `window.__AGENT_BROWSER_BENCHMARK_INDEX_URLS__` and `VITE_AGENT_BROWSER_BENCHMARK_INDEX_URLS`.
  - Accepts only HTTPS benchmark sources from reputable hosts such as Hugging Face, SWE-bench, LM Arena, Artificial Analysis, Epoch AI, OpenAI, Anthropic, and GitHub Blog.
  - Returns a persisted evidence state with status, retrieved time, records, and errors.
- `mergeDiscoveredBenchmarkEvidence()` overlays trusted discovered task scores onto fallback candidates before scoring. Route reasons then cite the discovered benchmark names, such as SWE-bench Verified or WebArena.
- `recommendBenchmarkRoute()`:
  - Returns a pinned candidate if the pin exists and is available.
  - Otherwise scores available candidates for the task class.
  - Applies objective weights while keeping deterministic tie-breaking.
- `inferBenchmarkTaskClass()`:
  - `planner` -> `planning`.
  - `researcher` -> `research`.
  - `debugger` -> `review`.
  - Prompt text mentioning tests, verify, lint, build, PR review -> `verification` or `review`.
  - Tool-enabled direct runs -> `browser-action`.
- Chat send flow:
  - Compute class and route after provider auto-routing.
  - If enabled, use the routed model id for GHCP or Codi runtime where compatible.
  - Keep existing error messages when the selected route has no available model.

### One-Shot LLM Prompt

```text
You are implementing Linear TK-46 in agent-browser. Build a focused benchmark-informed model routing feature.

Read AGENTS.md and follow TDD. Create a pure TypeScript service at agent-browser/src/services/benchmarkModelRouting.ts with task classes planning, browser-action, verification, research, and review. It should expose default settings, settings/evidence validators, model refs, candidate construction from GHCP Copilot models and installed Codi HF models, task inference from provider + latest prompt + tool state, trusted runtime benchmark evidence discovery, evidence merge, and deterministic recommendation logic that supports balanced, quality, cost, and latency objectives. Recommendations must honor valid pins and ignore unavailable pins.

Write Vitest tests first at agent-browser/src/services/benchmarkModelRouting.test.ts and watch them fail. Include tests that discover Hugging Face model-card model-index eval results, discover trusted remote benchmark-index records, reject untrusted source URLs, and prove discovered evidence can rerank the actual available candidates. Then implement the service.

Add localStorage keys in agent-browser/src/services/sessionState.ts for benchmark routing settings and benchmark evidence state, then update its tests.

Wire the feature into App.tsx: persist routing settings and evidence state, refresh benchmark evidence in the background on app startup/candidate changes, show Benchmark routing controls plus evidence refresh status in Settings, show a compact current recommendation in the chat header, and apply enabled recommendations during sendMessage. Planner, Researcher, and Debugger may route runtime between GHCP and Codi. Direct Codi and GHCP turns should stay compatible with the selected model-backed provider unless the selected provider itself is changed by existing routing.

Style the settings cards and header badge in App.css using existing provider-card/model-card patterns. Run focused tests, then npm.cmd run verify:agent-browser. Copy the visual smoke screenshot to docs/superpowers/plans/2026-05-02-benchmark-model-routing-visual-smoke.png and include it in the PR description.
```

---

### Task 1: Routing Service Tests

**Files:**
- Create: `agent-browser/src/services/benchmarkModelRouting.test.ts`
- Create later: `agent-browser/src/services/benchmarkModelRouting.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BENCHMARK_ROUTING_SETTINGS,
  buildBenchmarkRoutingCandidates,
  inferBenchmarkTaskClass,
  isBenchmarkRoutingSettings,
  recommendBenchmarkRoute,
} from './benchmarkModelRouting';

describe('benchmark model routing', () => {
  const candidates = buildBenchmarkRoutingCandidates({
    copilotModels: [
      { id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', reasoning: false, vision: true },
    ],
    installedModels: [
      { id: 'onnx-community/Qwen3-0.6B-ONNX', name: 'Qwen3 local', author: 'onnx-community', task: 'text-generation', downloads: 1, likes: 1, tags: [], status: 'installed' },
    ],
  });

  it('builds route candidates from available GHCP and installed Codi models', () => {
    expect(candidates.map((candidate) => candidate.ref)).toEqual([
      'ghcp:gpt-4.1',
      'ghcp:gpt-4o-mini',
      'codi:onnx-community/Qwen3-0.6B-ONNX',
    ]);
  });

  it('honors a valid per-task pin before auto scoring', () => {
    const route = recommendBenchmarkRoute({
      taskClass: 'verification',
      candidates,
      settings: {
        ...DEFAULT_BENCHMARK_ROUTING_SETTINGS,
        pins: { verification: 'codi:onnx-community/Qwen3-0.6B-ONNX' },
      },
    });
    expect(route?.candidate.ref).toBe('codi:onnx-community/Qwen3-0.6B-ONNX');
    expect(route?.reason).toContain('Pinned');
  });

  it('uses the cost objective to prefer cheaper sufficient models', () => {
    const route = recommendBenchmarkRoute({
      taskClass: 'browser-action',
      candidates,
      settings: { ...DEFAULT_BENCHMARK_ROUTING_SETTINGS, objective: 'cost' },
    });
    expect(route?.candidate.ref).toBe('ghcp:gpt-4o-mini');
  });

  it('infers task classes from provider and request text', () => {
    expect(inferBenchmarkTaskClass({ provider: 'planner', latestUserInput: 'break this down', toolsEnabled: false })).toBe('planning');
    expect(inferBenchmarkTaskClass({ provider: 'researcher', latestUserInput: 'find sources', toolsEnabled: false })).toBe('research');
    expect(inferBenchmarkTaskClass({ provider: 'codi', latestUserInput: 'run tests and verify the PR', toolsEnabled: true })).toBe('verification');
    expect(inferBenchmarkTaskClass({ provider: 'debugger', latestUserInput: 'inspect this crash', toolsEnabled: true })).toBe('review');
  });

  it('validates persisted routing settings', () => {
    expect(isBenchmarkRoutingSettings(DEFAULT_BENCHMARK_ROUTING_SETTINGS)).toBe(true);
    expect(isBenchmarkRoutingSettings({ enabled: true, objective: 'fast', pins: {} })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test -- src/services/benchmarkModelRouting.test.ts`

Expected: FAIL because `benchmarkModelRouting.ts` does not exist.

### Task 2: Routing Service Implementation

**Files:**
- Create: `agent-browser/src/services/benchmarkModelRouting.ts`

- [ ] **Step 1: Implement minimal service**

Implement the exported functions and types needed by the tests. Use deterministic weights and tie-breaking.

- [ ] **Step 2: Run focused tests**

Run: `npm.cmd --workspace agent-browser run test -- src/services/benchmarkModelRouting.test.ts`

Expected: PASS.

### Task 3: Storage Key

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/services/sessionState.test.ts`

- [ ] **Step 1: Add failing assertion**

Add `benchmarkModelRoutingSettings: expect.any(String)` to the storage key category test.

- [ ] **Step 2: Run session state test**

Run: `npm.cmd --workspace agent-browser run test -- src/services/sessionState.test.ts`

Expected: FAIL because the key is missing.

- [ ] **Step 3: Add key**

Add `benchmarkModelRoutingSettings: 'agent-browser.benchmark-model-routing-settings'` to `STORAGE_KEYS`.

- [ ] **Step 4: Run session state test**

Expected: PASS.

### Task 4: App Integration

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`

- [ ] **Step 1: Hydrate settings in app root**

Use `useStoredState(localStorageBackend, STORAGE_KEYS.benchmarkModelRoutingSettings, isBenchmarkRoutingSettings, DEFAULT_BENCHMARK_ROUTING_SETTINGS)`.

- [ ] **Step 2: Pass settings to ChatPanel and SettingsPanel**

Add typed props and pass setter callbacks.

- [ ] **Step 3: Render Settings controls**

Add a `BenchmarkRoutingSettings` component near provider/model settings with enable toggle, objective select, route cards, and pin selectors.

- [ ] **Step 4: Render current chat route**

Show a compact route badge beside model selectors when chat mode is active.

- [ ] **Step 5: Apply route during send**

Compute the current task class and recommended model ref. Use routed model ids for runtime config and process metadata.

### Task 5: Verification and PR

**Files:**
- Generated screenshot: `docs/superpowers/plans/2026-05-02-benchmark-model-routing-visual-smoke.png`

- [ ] **Step 1: Run focused tests**

Run:
`npm.cmd --workspace agent-browser run test -- src/services/benchmarkModelRouting.test.ts src/services/sessionState.test.ts`

- [ ] **Step 2: Run full verifier**

Run: `npm.cmd run verify:agent-browser`

- [ ] **Step 3: Copy visual smoke screenshot**

Copy `output/playwright/agent-browser-visual-smoke.png` to the plan screenshot path.

- [ ] **Step 4: Publish PR**

Use `scripts/codex-git.ps1` and `scripts/codex-gh.ps1` where possible. Add labels `codex` and `codex-automation`, link TK-46, and include the screenshot path in the PR body.

- [ ] **Step 5: Complete Linear**

Move TK-46 to Done after PR creation and validation.
