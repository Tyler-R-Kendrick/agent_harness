# Harness Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first Agent Browser harness-evolution control plane that plans safe sandboxed patch-package changes, records fallback behavior, and requires visual validation for UI/styling evolution.

**Architecture:** Keep the first slice deterministic and local: a pure `harnessEvolution` service owns settings validation, sandbox plan construction, fallback/safe-mode actions, and prompt context. `App.tsx` persists settings with `useStoredState`, injects the prompt context into chat runs, and exposes a compact Settings proof surface alongside Harness core, steering, and runtime plugins.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, existing `useStoredState`, Settings panels, `visual:agent-browser`, `patch-package`.

---

## Feature Implementation Plan

Linear TK-14 asks for a harness that can evolve itself by generating patches in a sandbox, validating them before adoption, falling back to original code when patched components fail, and supporting safe visual/styling augmentation. The first shippable slice should not execute arbitrary patching automatically. It should make the evolution workflow first-class, deterministic, persisted, and visible so chat agents and future runtime hooks have a shared contract.

Deliverables:

- Pure service for harness-evolution settings, patch plans, validation plans, fallback actions, and prompt context.
- Persistent settings key under `agent-browser/src/services/sessionState.ts`.
- Settings panel that shows enabled state, safe-mode fallback, visual validation requirement, sandbox root, patch command, validation commands, and protected scopes.
- Chat prompt context that tells agents to use sandboxed patch-package flow, validate before adoption, and keep styling changes scoped.
- Smoke and visual-smoke coverage that opens Settings and verifies the new surface.
- Plan/spec/one-shot prompt artifact in this file.

## Technical Spec

### Data Model

Create `agent-browser/src/services/harnessEvolution.ts`.

Types:

- `HarnessEvolutionSettings`
  - `enabled: boolean`
  - `safeModeOnFailure: boolean`
  - `requireVisualValidation: boolean`
  - `sandboxRoot: string`
  - `patchPackageCommand: string`
  - `allowedPatchScopes: string[]`
  - `validationCommands: string[]`
- `HarnessEvolutionRequest`
  - `componentId: string`
  - `changeSummary: string`
  - `touchesStyling?: boolean`
  - `failure?: { message: string; componentId?: string; debugArtifactPaths?: string[] }`
- `HarnessEvolutionPlan`
  - `enabled: boolean`
  - `componentId: string`
  - `sandboxId: string`
  - `patchPackageCommand: string`
  - `validationCommands: string[]`
  - `adoptionGate: string[]`
  - `fallbackActions: string[]`
  - `protectedScopes: string[]`
  - `visualValidationRequired: boolean`
  - `summary: string`

Defaults:

- Enabled by default because this is a control plane, not automatic execution.
- Safe mode on failure enabled.
- Visual validation required.
- Sandbox root: `.harness-evolution/sandboxes`
- Patch command: `npx patch-package`
- Allowed scopes: `agent-browser/src/features/harness-ui`, `agent-browser/src/services`, `agent-browser/src/App.tsx`, `agent-browser/src/App.css`
- Validation commands: `npm.cmd --workspace agent-browser run test:scripts`, `npm.cmd --workspace agent-browser run lint`, `npm.cmd run visual:agent-browser`

### Service Behavior

- `isHarnessEvolutionSettings(value)` accepts only complete settings objects with booleans and string arrays.
- `normalizeHarnessEvolutionSettings(settings)` trims and deduplicates commands/scopes and restores defaults for empty required arrays/strings.
- `buildHarnessEvolutionPlan({ settings, request })` returns a deterministic plan with a stable sandbox id, patch-package command, validation gates, safe-mode fallback actions, and styling-specific visual validation.
- `buildHarnessEvolutionPromptContext(plan)` returns empty text when disabled, otherwise emits a short `## Harness Evolution` section for chat prompts.

### App Wiring

Modify `agent-browser/src/App.tsx`:

- Import `DEFAULT_HARNESS_EVOLUTION_SETTINGS`, `buildHarnessEvolutionPlan`, `buildHarnessEvolutionPromptContext`, `isHarnessEvolutionSettings`, and types.
- Add a `useStoredState` call using `STORAGE_KEYS.harnessEvolutionSettings`.
- Build a default active plan from the active workspace/session and current settings.
- Add prompt context to the existing chat `systemInstructions` context list.
- Add `harness evolution` status to `contextSummary`.
- Add `HarnessEvolutionSettingsPanel` under Settings, near Harness steering/runtime plugins.
- Pass settings and setters through `SettingsPanelProps`.

Modify `agent-browser/src/services/sessionState.ts`:

- Add `harnessEvolutionSettings: 'agent-browser.harness-evolution-settings'`.

Modify `agent-browser/src/App.smoke.test.tsx`:

- Add a smoke test that opens Settings, expands `Harness evolution`, verifies the safe-mode and visual-validation controls, and checks updates persist into `localStorage`.

Modify `agent-browser/scripts/visual-smoke.mjs`:

- Open Settings, expand `Harness evolution`, and assert the safe-mode and visual-validation controls are visible.

### Visual Design

Use the existing Settings idioms: `SettingsSection`, `provider-card`, compact metrics, checkbox controls, and command chips. Keep the panel dense and operational. Avoid a separate route or nested cards.

## One-Shot LLM Prompt

Implement Linear TK-14 Harness Evolution in `agent-browser` using TDD.

Build a deterministic first slice of a harness-evolution control plane. Add `agent-browser/src/services/harnessEvolution.ts` plus tests. The service must define persisted settings, validate/normalize settings, build a safe sandbox patch plan for a requested harness change, include patch-package adoption gates, safe-mode fallback actions, protected scope summaries, styling-aware visual validation, and a prompt-context block for chat agents. Do not execute arbitrary patches automatically.

Persist settings through `agent-browser/src/services/sessionState.ts` with key `agent-browser.harness-evolution-settings`. Wire `App.tsx` so active chat prompts include the Harness Evolution context, context summary reports whether it is on, and Settings has a compact `Harness evolution` panel with enabled, safe-mode, visual-validation, sandbox root, patch command, validation command, and protected scope controls. Add smoke and visual-smoke coverage for the Settings surface.

Follow existing Agent Browser patterns for settings panels, storage validators, service tests, and visual-smoke assertions. Use `npm.cmd` in documented validation commands. Run focused tests first, then the full `npm run verify:agent-browser` gate if the environment allows it. If Windows sandbox permissions block Vitest/Vite/GitHub, preserve exact blocker strings in Linear and automation memory.

## TDD Plan

### Task 1: Harness Evolution Service

**Files:**
- Create: `agent-browser/src/services/harnessEvolution.ts`
- Create: `agent-browser/src/services/harnessEvolution.test.ts`

- [ ] **Step 1: Write failing service tests**

```ts
import {
  DEFAULT_HARNESS_EVOLUTION_SETTINGS,
  buildHarnessEvolutionPlan,
  buildHarnessEvolutionPromptContext,
  isHarnessEvolutionSettings,
  normalizeHarnessEvolutionSettings,
} from './harnessEvolution';

describe('harnessEvolution', () => {
  it('validates and normalizes persisted settings', () => {
    expect(isHarnessEvolutionSettings(DEFAULT_HARNESS_EVOLUTION_SETTINGS)).toBe(true);
    expect(isHarnessEvolutionSettings({ enabled: true })).toBe(false);

    const normalized = normalizeHarnessEvolutionSettings({
      ...DEFAULT_HARNESS_EVOLUTION_SETTINGS,
      sandboxRoot: '  ',
      patchPackageCommand: '',
      allowedPatchScopes: ['agent-browser/src/App.tsx', 'agent-browser/src/App.tsx', '  '],
      validationCommands: [' npm.cmd run visual:agent-browser ', 'npm.cmd run visual:agent-browser'],
    });

    expect(normalized.sandboxRoot).toBe(DEFAULT_HARNESS_EVOLUTION_SETTINGS.sandboxRoot);
    expect(normalized.patchPackageCommand).toBe(DEFAULT_HARNESS_EVOLUTION_SETTINGS.patchPackageCommand);
    expect(normalized.allowedPatchScopes).toEqual(['agent-browser/src/App.tsx']);
    expect(normalized.validationCommands).toEqual(['npm.cmd run visual:agent-browser']);
  });

  it('builds a sandboxed patch plan with safe-mode fallback and visual gates', () => {
    const plan = buildHarnessEvolutionPlan({
      settings: DEFAULT_HARNESS_EVOLUTION_SETTINGS,
      request: {
        componentId: 'HarnessDashboardPanel',
        changeSummary: 'Allow users to add a visual dashboard widget',
        touchesStyling: true,
        failure: {
          message: 'Rendered widget crashed on mount',
          componentId: 'HarnessDashboardPanel',
          debugArtifactPaths: ['output/playwright/agent-browser-visual-smoke.png'],
        },
      },
    });

    expect(plan.sandboxId).toBe('harness-dashboard-panel');
    expect(plan.visualValidationRequired).toBe(true);
    expect(plan.validationCommands).toContain('npm.cmd run visual:agent-browser');
    expect(plan.fallbackActions.join(' ')).toContain('safe mode');
    expect(plan.fallbackActions.join(' ')).toContain('Rendered widget crashed on mount');
  });

  it('renders prompt context only when enabled', () => {
    const disabledPlan = buildHarnessEvolutionPlan({
      settings: { ...DEFAULT_HARNESS_EVOLUTION_SETTINGS, enabled: false },
      request: { componentId: 'HarnessDashboardPanel', changeSummary: 'Try a patch' },
    });
    expect(buildHarnessEvolutionPromptContext(disabledPlan)).toBe('');

    const enabledPlan = buildHarnessEvolutionPlan({
      settings: DEFAULT_HARNESS_EVOLUTION_SETTINGS,
      request: { componentId: 'HarnessDashboardPanel', changeSummary: 'Try a patch' },
    });
    expect(buildHarnessEvolutionPromptContext(enabledPlan)).toContain('## Harness Evolution');
    expect(buildHarnessEvolutionPromptContext(enabledPlan)).toContain('npx patch-package');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test -- src/services/harnessEvolution.test.ts`

Expected: FAIL because `./harnessEvolution` does not exist.

- [ ] **Step 3: Implement the service**

Create the types, defaults, validators, normalizer, plan builder, prompt-context builder, and small helpers.

- [ ] **Step 4: Run service tests**

Run: `npm.cmd --workspace agent-browser run test -- src/services/harnessEvolution.test.ts`

Expected: PASS.

### Task 2: Persistence and App Settings UI

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/services/sessionState.test.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.smoke.test.tsx`

- [ ] **Step 1: Write failing persistence/UI tests**

Add `STORAGE_KEYS.harnessEvolutionSettings` assertions to `sessionState.test.ts`. Add an App smoke test that opens Settings, expands `Harness evolution`, verifies `Enable harness evolution`, `Fallback to safe mode on failure`, `Require visual validation`, and persists disabling the feature into `localStorage`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm.cmd --workspace agent-browser run test -- src/services/sessionState.test.ts src/App.smoke.test.tsx -t "harness evolution|storage keys"`

Expected: FAIL because the storage key and Settings panel are missing.

- [ ] **Step 3: Implement persistence and UI**

Add the storage key, App state, prompt-context wiring, context-summary text, Settings props, and `HarnessEvolutionSettingsPanel`.

- [ ] **Step 4: Run focused tests**

Run: `npm.cmd --workspace agent-browser run test -- src/services/harnessEvolution.test.ts src/services/sessionState.test.ts src/App.smoke.test.tsx -t "harness evolution|storage keys"`

Expected: PASS.

### Task 3: Visual Smoke and Full Verification

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Add after successful visual run: `docs/superpowers/plans/2026-05-08-harness-evolution-visual-smoke.png`

- [ ] **Step 1: Write failing visual-smoke assertion**

Add Settings navigation that expands `Harness evolution` and checks the safe-mode and visual-validation controls.

- [ ] **Step 2: Run syntax/check gate**

Run: `node --check agent-browser/scripts/visual-smoke.mjs`

Expected: PASS syntax; runtime may fail if dependencies or Vite child processes are blocked.

- [ ] **Step 3: Run visual smoke**

Run: `npm.cmd run visual:agent-browser`

Expected: PASS and screenshot at `output/playwright/agent-browser-visual-smoke.png`.

- [ ] **Step 4: Run full verifier**

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`

Expected: PASS generated-file check, eval validation/tests, script tests, lint, coverage, build, audit, and visual smoke.

## Self-Review

- Spec coverage: covers sandboxed patch-package planning, safe-mode fallback, debug artifacts, visual/styling validation, scoped patch surfaces, Settings proof UI, prompt context, TDD, and verification.
- Placeholder scan: no TBD/TODO/fill-in-later placeholders remain.
- Type consistency: settings, request, plan, and prompt-context names are consistent across service, persistence, App UI, and tests.
