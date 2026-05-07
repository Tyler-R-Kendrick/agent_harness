# Durable Suspend/Resume Checkpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable suspend/resume checkpoints for Agent Browser runs so approval, credential, and delayed-input pauses are persisted, auditable, visible, and resumable from the same browser-task boundary.

**Architecture:** Implement a deterministic `runCheckpoints` service that owns checkpoint state, validation, mutation, resume decisions, and process-log entries. Persist checkpoint state through `sessionState` and surface it in the existing History and Settings panels, with ProcessPanel awareness for suspended assistant turns.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Playwright visual smoke, existing `useStoredState`, `ProcessLog`, and Agent Browser Settings/History UI.

---

## Feature Implementation Plan

1. Add a pure TypeScript checkpoint state service with default seeded checkpoints, runtime policy, validators, and mutation helpers.
2. Add a durable localStorage key for checkpoint state and hydrate it through `useStoredState`.
3. Show active/due checkpoints in History and expose timeout/operator policy controls in Settings.
4. Mark suspended process turns in the Process graph with a checkpoint strip and drill-down metadata.
5. Add focused service, smoke, process-panel, script, and visual smoke coverage.
6. Run the Agent Browser verifier and publish a PR with screenshot evidence.

## Architecture-Aligned Technical Spec

### Data Model

`agent-browser/src/services/runCheckpoints.ts` owns:

- `RunCheckpointState`: `{ checkpoints, audit, policy }`
- `RunCheckpoint`: persisted pause boundary with `id`, `sessionId`, `workspaceId`, `reason`, `status`, `resumeToken`, `boundary`, `artifacts`, `requiredInput`, timestamps, and timeout.
- `RunCheckpointAuditEntry`: append-only operator audit for suspend, resume, expire, and cancel events.
- `RunCheckpointPolicy`: default timeout and whether approval/credential/delayed-input checkpoints require operator confirmation.

### Runtime Behavior

- `createRunCheckpoint` appends a suspended checkpoint plus an audit row.
- `resumeRunCheckpoint` transitions only suspended/expired checkpoints to resumed, records operator/evidence, and preserves the stable resume token.
- `expireDueRunCheckpoints` marks checkpoints expired when `expiresAt <= now`.
- `buildCheckpointProcessEntry` returns a `ProcessEntry` with `kind: "handoff"` and `status: "active"` so suspended messages show as active pause boundaries.
- `buildCheckpointPromptContext` summarizes active checkpoints for future agent turns.

### UI Behavior

- History receives the checkpoint state and renders a "Suspend/resume checkpoints" section before recent activity.
- Settings gets a "Suspend/resume checkpoints" section with policy controls and active checkpoint rows.
- ProcessPanel reads checkpoint payloads from process entries and renders a compact "Suspended checkpoint" strip above the process graph.
- Mobile layout keeps checkpoint controls in one-column grids below 520px.

### Persistence

- Add `STORAGE_KEYS.runCheckpointState = "agent-browser.run-checkpoint-state"`.
- Hydrate with `useStoredState(localStorageBackend, STORAGE_KEYS.runCheckpointState, isRunCheckpointState, DEFAULT_RUN_CHECKPOINT_STATE)`.

### Visual Evidence

- Extend `agent-browser/scripts/visual-smoke.mjs` with localStorage checkpoint seed data and assertions for:
  - History checkpoint summary
  - Settings checkpoint policy controls
  - ProcessPanel suspended checkpoint strip

## One-Shot LLM Prompt

You are implementing Linear issue TK-39 in `agent-browser`: durable suspend/resume checkpoints for browser-agent runs. Follow existing Agent Browser patterns. Add `agent-browser/src/services/runCheckpoints.ts` with deterministic state helpers, validators, prompt context, and process-entry projection. Add tests first in `runCheckpoints.test.ts`, then wire a durable `runCheckpointState` storage key through `sessionState.ts` and `App.tsx`. Render checkpoint summaries in History, policy controls in Settings, and a suspended checkpoint strip in `ProcessPanel` when process entries include checkpoint payloads. Extend `App.smoke.test.tsx`, `ProcessPanel.test.tsx`, and `scripts/visual-smoke.mjs`. Keep UI mobile-first and accessible: labels on all controls, stable grid dimensions, no nested cards. Run focused tests, `npm.cmd --workspace agent-browser run test:scripts`, `npm.cmd run visual:agent-browser`, and `npm.cmd run verify:agent-browser`. Save screenshot evidence under `docs/superpowers/plans/2026-05-07-durable-suspend-resume-checkpoints-visual-smoke.png`, then commit, push, open a PR labeled `codex` and `codex-automation`, link it to TK-39, and move TK-39 to Done.

## File Structure

- Create: `agent-browser/src/services/runCheckpoints.ts`
  - Pure state types, defaults, validators, audit helpers, process-entry projection, and prompt-context builder.
- Create: `agent-browser/src/services/runCheckpoints.test.ts`
  - Red/green tests for creation, resume, expiration, validation, prompt context, and process entry projection.
- Modify: `agent-browser/src/services/sessionState.ts`
  - Add durable storage key.
- Modify: `agent-browser/src/features/process/ProcessPanel.tsx`
  - Render checkpoint strip from process-entry payloads.
- Modify: `agent-browser/src/features/process/ProcessPanel.test.tsx`
  - Assert checkpoint strip from a suspended handoff entry.
- Modify: `agent-browser/src/App.tsx`
  - Hydrate checkpoint state, render History and Settings sections, and pass state through panels.
- Modify: `agent-browser/src/App.smoke.test.tsx`
  - Assert checkpoint History/Settings UI.
- Modify: `agent-browser/src/App.css`
  - Add responsive checkpoint layouts matching existing cards.
- Modify: `agent-browser/scripts/visual-smoke.mjs`
  - Seed checkpoint state and assert visible History, Settings, and ProcessPanel checkpoint surfaces.

## TDD Task Plan

### Task 1: Service Model

**Files:**
- Create: `agent-browser/src/services/runCheckpoints.test.ts`
- Create: `agent-browser/src/services/runCheckpoints.ts`

- [ ] **Step 1: Write failing service tests**

```ts
it('creates resumable approval checkpoints with audit and process metadata', () => {
  const state = createRunCheckpoint(DEFAULT_RUN_CHECKPOINT_STATE, {
    sessionId: 'session-1',
    workspaceId: 'ws-research',
    reason: 'approval',
    summary: 'Approve deployment',
    boundary: 'before deploy tool call',
    requiredInput: 'human approval',
    artifacts: ['plan.md'],
    now: new Date('2026-05-07T03:00:00.000Z'),
  });
  expect(state.checkpoints[0].status).toBe('suspended');
  expect(state.checkpoints[0].resumeToken).toMatch(/^resume:/);
  expect(state.audit[0].action).toBe('suspended');
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/services/runCheckpoints.test.ts`
Expected: FAIL because `runCheckpoints.ts` does not exist.

- [ ] **Step 3: Implement minimal service**

Add exported types, defaults, `createRunCheckpoint`, `resumeRunCheckpoint`, `expireDueRunCheckpoints`, `isRunCheckpointState`, `buildCheckpointProcessEntry`, and `buildCheckpointPromptContext`.

- [ ] **Step 4: Run service test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/services/runCheckpoints.test.ts`
Expected: PASS with all new service tests.

### Task 2: Persistence And App UI

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.smoke.test.tsx`
- Modify: `agent-browser/src/App.css`

- [ ] **Step 1: Add failing smoke assertions**

Add App smoke coverage that clicks History and Settings and expects "Suspend/resume checkpoints", "Approval before deployment", and "Default checkpoint timeout".

- [ ] **Step 2: Run smoke test to verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx`
Expected: FAIL because checkpoint UI is absent.

- [ ] **Step 3: Wire persisted state and UI**

Hydrate `runCheckpointState`, pass it to History/Settings, and implement checkpoint summary/settings panels with accessible controls.

- [ ] **Step 4: Run smoke test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx`
Expected: PASS for checkpoint smoke coverage.

### Task 3: Process Panel Checkpoint Surface

**Files:**
- Modify: `agent-browser/src/features/process/ProcessPanel.test.tsx`
- Modify: `agent-browser/src/features/process/ProcessPanel.tsx`

- [ ] **Step 1: Add failing process-panel test**

Render a message with a `handoff` process entry whose payload contains a suspended checkpoint. Expect "Suspended checkpoint", "approval", and the resume token.

- [ ] **Step 2: Run process-panel test to verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/features/process/ProcessPanel.test.tsx`
Expected: FAIL because no checkpoint strip is rendered.

- [ ] **Step 3: Render checkpoint strip**

Derive checkpoint payloads from process entries and render a compact accessible strip above the graph.

- [ ] **Step 4: Run process-panel test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/features/process/ProcessPanel.test.tsx`
Expected: PASS.

### Task 4: Visual Smoke And Full Verification

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`

- [ ] **Step 1: Add visual-smoke assertions**

Seed checkpoint state and a checkpoint process entry; assert History, Settings, and ProcessPanel checkpoint surfaces.

- [ ] **Step 2: Run script checks**

Run: `npm.cmd --workspace agent-browser run test:scripts`
Expected: PASS.

- [ ] **Step 3: Run visual smoke**

Run: `npm.cmd run visual:agent-browser`
Expected: PASS and write `output/playwright/agent-browser-visual-smoke.png`.

- [ ] **Step 4: Run full verifier**

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`
Expected: PASS.

## Self-Review

- Spec coverage: service, persistence, History, Settings, ProcessPanel, visual evidence, and verifier coverage are mapped to tasks.
- Placeholder scan: no TBD/TODO/fill-in placeholders.
- Type consistency: all task references use `RunCheckpoint*`, `runCheckpointState`, and `buildCheckpointProcessEntry` consistently.
