# Spec-Driven Development Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Agent Browser spec-driven development loop that makes agents write, validate, revise, and use machine-readable specs before implementation.

**Architecture:** Add a deterministic `specDrivenDevelopment` service for settings, lifecycle inference, ambiguity tracking, validation planning, feedback revision prompts, and prompt context. Persist the settings through `sessionState`, surface controls in Settings, and inject the active spec workflow into chat prompt context so all providers inherit the behavior.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Vite, localStorage-backed settings, Playwright visual smoke.

---

## Feature Implementation Plan

TK-17 asks Agent Browser to begin work by writing specs, identify ambiguities, iterate on those specs, then write tests/evals and continue with red/green cycles using user feedback. The implementation keeps that workflow local and offline by default:

- Select a spec format from task text: JSON Schema 2020-12 for general data/output contracts, OpenAPI 3.1 for HTTP API work, AsyncAPI 3.1 for event-driven work, RFC 9457 for HTTP error payloads, Mermaid for visual flow specs, or Markdown contract when the task is prose-first.
- Track whether the loop is in `research`, `draft-spec`, `resolve-ambiguities`, `write-tests`, `red-green`, or `feedback-revision`.
- Generate prompt context that tells the selected agent to draft the spec first, list ambiguities, ask for user feedback when quality is unclear, and write tests/evals against the spec before implementation.
- Surface a Settings panel so users can enable/disable the loop, select the default format, require ambiguity resolution, and require eval coverage.

## Architecture-Aligned Technical Spec

### New Service

`agent-browser/src/services/specDrivenDevelopment.ts`

Responsibilities:
- Define `SpecDrivenDevelopmentSettings`, `SpecFormat`, `SpecLifecycleStage`, `SpecWorkflowPlan`, and `SpecWorkflowFeedback`.
- Export `DEFAULT_SPEC_DRIVEN_DEVELOPMENT_SETTINGS`.
- Export validators for persisted settings.
- Export `createSpecWorkflowPlan(input)` to infer format, lifecycle stage, ambiguity questions, and validation gates from a task and settings.
- Export `buildSpecDrivenDevelopmentPromptContext(plan)` for provider-neutral prompt injection.
- Export `buildSpecFeedbackRevisionPrompt(feedback)` to turn user quality feedback into a spec revision directive.

### Persistence

`agent-browser/src/services/sessionState.ts`

Add:

```ts
specDrivenDevelopmentSettings: 'agent-browser.spec-driven-development-settings',
```

Use `useStoredState` in `App.tsx` with the new validator and default settings.

### App Integration

`agent-browser/src/App.tsx`

Add imports from the new service. Create a memoized `specWorkflowPlan` from the current input and settings. Add `buildSpecDrivenDevelopmentPromptContext(specWorkflowPlan)` to the request prompt context. Add `spec ${enabled ? lifecycleStage : 'off'}` to the context strip. Add a `SpecDrivenDevelopmentSettingsPanel` inside Settings with:

- enable checkbox
- default format select
- require ambiguity resolution checkbox
- require eval coverage checkbox
- summary card showing the current lifecycle, selected format, and validation gates
- list of active ambiguity questions

### Styling

`agent-browser/src/App.css`

Reuse existing Settings grid/card patterns and add narrow, mobile-safe selectors for spec settings. Keep cards at 6px radius, wrap long spec identifiers, and collapse grids to one column on narrow viewports.

### Tests

Add `agent-browser/src/services/specDrivenDevelopment.test.ts` with red-first coverage for:

- persisted settings validation rejects malformed data
- format inference chooses OpenAPI, AsyncAPI, RFC 9457, Mermaid, or JSON Schema
- ambiguity extraction catches unclear acceptance criteria and missing examples
- prompt context includes spec-first, ambiguity, eval, and red/green instructions
- feedback revision prompt preserves user feedback and asks for spec changes before code changes

Extend `agent-browser/src/App.smoke.test.tsx` with a Settings smoke test:

- opens Settings
- finds `Spec-driven development`
- checks defaults
- changes default format to OpenAPI
- verifies summary text and controls render

Extend `agent-browser/scripts/visual-smoke.mjs`:

- open Settings
- expand Spec-driven development
- assert controls are visible
- capture a PR-visible screenshot at `docs/superpowers/plans/2026-05-08-spec-driven-development-visual-smoke.png`

## One-Shot LLM Prompt

Implement Linear TK-17 in Agent Browser.

Use TDD. Start by adding failing Vitest coverage for a new `specDrivenDevelopment` service and a Settings smoke test. The service must define persisted settings, validate settings safely, infer a spec format from task text, produce a lifecycle plan with ambiguity questions and validation gates, build provider-neutral prompt context, and build feedback revision prompts.

Then implement the minimal production code:

1. Create `agent-browser/src/services/specDrivenDevelopment.ts`.
2. Add `specDrivenDevelopmentSettings` to `STORAGE_KEYS`.
3. Wire settings state into `App.tsx`.
4. Add spec-driven prompt context to every chat request.
5. Add a Settings panel using existing `SettingsSection`, `provider-card`, `settings-checkbox-row`, and compact grid patterns.
6. Add CSS that keeps the new controls usable on mobile and avoids overflow.
7. Add visual-smoke assertions and screenshot output.

Use the following researched standards as baked-in guidance:

- JSON Schema 2020-12 for general machine-readable data contracts.
- OpenAPI 3.1 for HTTP APIs.
- AsyncAPI 3.1 for message/event APIs.
- RFC 9457 for HTTP problem/error response shapes.
- Mermaid for visual process or state diagrams.

Run focused tests first, then `npm.cmd run verify:agent-browser`. If verification fails, fix every blocking warning/error in the workspace before publishing. Commit, push, open a PR with `codex` and `codex-automation` labels, include the visual screenshot in the PR description, resolve conflicts/status failures, merge when green, and move TK-17 to Done.

## Task Plan

### Task 1: Service Contract

**Files:**
- Create: `agent-browser/src/services/specDrivenDevelopment.test.ts`
- Create: `agent-browser/src/services/specDrivenDevelopment.ts`

- [ ] **Step 1: Write the failing service tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPEC_DRIVEN_DEVELOPMENT_SETTINGS,
  buildSpecDrivenDevelopmentPromptContext,
  buildSpecFeedbackRevisionPrompt,
  createSpecWorkflowPlan,
  isSpecDrivenDevelopmentSettings,
} from './specDrivenDevelopment';

describe('specDrivenDevelopment', () => {
  it('validates persisted settings and rejects malformed values', () => {
    expect(isSpecDrivenDevelopmentSettings(DEFAULT_SPEC_DRIVEN_DEVELOPMENT_SETTINGS)).toBe(true);
    expect(isSpecDrivenDevelopmentSettings({ enabled: true })).toBe(false);
  });

  it('selects domain standard spec formats from task text', () => {
    expect(createSpecWorkflowPlan({ task: 'Add REST endpoints for projects' }).format).toBe('openapi');
    expect(createSpecWorkflowPlan({ task: 'Design Kafka topic events for updates' }).format).toBe('asyncapi');
    expect(createSpecWorkflowPlan({ task: 'Standardize 422 validation errors' }).format).toBe('problem-details');
    expect(createSpecWorkflowPlan({ task: 'Draw the checkout state machine' }).format).toBe('mermaid');
    expect(createSpecWorkflowPlan({ task: 'Return structured extraction results' }).format).toBe('json-schema');
  });

  it('plans ambiguity resolution and validation gates before implementation', () => {
    const plan = createSpecWorkflowPlan({ task: 'Build a good dashboard' });
    expect(plan.stage).toBe('resolve-ambiguities');
    expect(plan.ambiguities).toContain('Define measurable acceptance criteria.');
    expect(plan.validationGates).toContain('Write tests or evals that validate the spec before implementation.');
  });

  it('builds prompt context for spec-first red green implementation', () => {
    const context = buildSpecDrivenDevelopmentPromptContext(createSpecWorkflowPlan({
      task: 'Add an HTTP API with validation errors',
    }));
    expect(context).toContain('## Spec-Driven Development');
    expect(context).toContain('Write or update the spec before implementation.');
    expect(context).toContain('OpenAPI 3.1');
    expect(context).toContain('red/green');
  });

  it('turns user output feedback into a spec revision prompt', () => {
    const prompt = buildSpecFeedbackRevisionPrompt({
      specId: 'spec:dashboard',
      feedback: 'The empty state is unclear.',
      outputSummary: 'Dashboard cards render without an empty state contract.',
    });
    expect(prompt).toContain('spec:dashboard');
    expect(prompt).toContain('The empty state is unclear.');
    expect(prompt).toContain('Revise the spec before changing implementation.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test -- src/services/specDrivenDevelopment.test.ts`

Expected: FAIL because `./specDrivenDevelopment` does not exist.

- [ ] **Step 3: Implement the service**

Create the exported types, defaults, validators, inference helpers, lifecycle planner, prompt context, and feedback prompt exactly as exercised by the tests.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd --workspace agent-browser run test -- src/services/specDrivenDevelopment.test.ts`

Expected: PASS.

### Task 2: App Persistence And Prompt Context

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/App.tsx`
- Test: `agent-browser/src/App.smoke.test.tsx`

- [ ] **Step 1: Write the failing App smoke test**

Add a smoke test that opens Settings, expands `Spec-driven development`, and asserts the enable checkbox, default format select, eval coverage checkbox, ambiguity resolution checkbox, current format, and validation gates are visible.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx --testNamePattern "renders spec-driven development controls"`

Expected: FAIL because the Settings panel is not present.

- [ ] **Step 3: Wire persistence and prompt context**

Add `STORAGE_KEYS.specDrivenDevelopmentSettings`, import the service helpers into `App.tsx`, create stored state, build `specWorkflowPlan`, append its prompt context to chat request context, add spec state to the context strip, and pass settings into `SettingsPanel`.

- [ ] **Step 4: Add Settings UI**

Add `SpecDrivenDevelopmentSettingsPanel` near other workflow settings. Use checkbox/select/list controls with accessible labels:

- `Enable spec-driven development`
- `Default spec format`
- `Resolve ambiguities before implementation`
- `Require tests or evals from spec`

- [ ] **Step 5: Run the App smoke test**

Run: `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx --testNamePattern "renders spec-driven development controls"`

Expected: PASS.

### Task 3: Visual Review Coverage

**Files:**
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/scripts/visual-smoke.mjs`

- [ ] **Step 1: Add responsive styles**

Add `.spec-driven-development-settings`, `.spec-driven-development-summary-card`, `.spec-driven-development-grid`, and `.spec-driven-development-list` rules using existing card variables and mobile one-column behavior.

- [ ] **Step 2: Add visual-smoke assertions**

In Settings, expand the new panel, assert the visible controls, and capture `docs/superpowers/plans/2026-05-08-spec-driven-development-visual-smoke.png`.

- [ ] **Step 3: Run visual smoke**

Run: `npm.cmd run visual:agent-browser`

Expected: PASS and screenshot written.

### Task 4: Full Verification And Publish

**Files:**
- All changed files

- [ ] **Step 1: Run focused checks**

Run:

```powershell
npm.cmd --workspace agent-browser run test -- src/services/specDrivenDevelopment.test.ts
npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx --testNamePattern "spec-driven development"
npm.cmd run check:generated-files
.\scripts\codex-git.ps1 diff --check
```

Expected: all pass.

- [ ] **Step 2: Run full gate**

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`

Expected: generated-file check, eval validation/tests, script tests, lint, coverage, build, audit, and visual smoke pass.

- [ ] **Step 3: Publish and merge**

Run:

```powershell
.\scripts\codex-git.ps1 switch -c codex/tk-17-spec-driven-development
.\scripts\codex-git.ps1 add agent-browser/src/services/specDrivenDevelopment.ts agent-browser/src/services/specDrivenDevelopment.test.ts agent-browser/src/services/sessionState.ts agent-browser/src/App.tsx agent-browser/src/App.css agent-browser/src/App.smoke.test.tsx agent-browser/scripts/visual-smoke.mjs docs/superpowers/plans/2026-05-08-spec-driven-development.md docs/superpowers/plans/2026-05-08-spec-driven-development-visual-smoke.png
.\scripts\codex-git.ps1 commit -m "feat: add spec-driven development loop"
.\scripts\codex-git.ps1 push -u origin codex/tk-17-spec-driven-development
.\scripts\codex-gh.ps1 pr create --title "Add spec-driven development loop" --body-file <generated-pr-body> --base main --head codex/tk-17-spec-driven-development
```

Then add `codex` and `codex-automation`, resolve conflicts/check failures, merge when green, and move TK-17 to Done.

## Self-Review

- Spec coverage: TK-17 research, spec-first workflow, ambiguity iteration, tests/evals, red/green cycles, and user feedback revision are covered.
- Placeholder scan: no TODO/TBD placeholders remain.
- Type consistency: settings, lifecycle, plan, and prompt names are stable across tasks.
