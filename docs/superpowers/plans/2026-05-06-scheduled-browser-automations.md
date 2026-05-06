# Scheduled Browser Automations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a durable Agent Browser scheduler surface for one-off and recurring browser automation checks with run evidence, retry policy, notification routing, and review inbox state.

**Architecture:** Keep execution local to the existing Agent Browser app shell. Add a pure `scheduledAutomations` service that validates persisted scheduler state, projects due runs, records run evidence, and derives review inbox items, then surface the state in the existing History and Settings panels through `sessionState` durable storage.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, existing `agent-browser` services, `sessionState` storage helpers, and `visual:agent-browser` for browser validation.

---

## Linear Source

Issue: TK-22, "Run browser automations on schedules"

Problem: Users need recurring checks, audits, and verification runs without manually re-triggering the harness.

Desired outcome: Add scheduled one-off and recurring automations with execution history, last-run evidence, retry controls, notification routing, and an inbox queue for results requiring review.

## Files

- Create: `agent-browser/src/services/scheduledAutomations.ts`
- Create: `agent-browser/src/services/scheduledAutomations.test.ts`
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/services/sessionState.test.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/src/App.smoke.test.tsx`
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Modify: `agent-browser/scripts/run-script-tests.mjs`

## Technical Spec

### Scheduler Model

`scheduledAutomations.ts` owns these exported contracts:

- `ScheduledAutomation`: stable `id`, `title`, `prompt`, `cadence`, `enabled`, `nextRunAt`, `retryPolicy`, `notificationRoute`, `requiresReviewOn`, `createdAt`, and `updatedAt`.
- `ScheduledAutomationRun`: stable run evidence with `automationId`, `status`, `startedAt`, `completedAt`, `attempt`, `summary`, `evidence`, and `requiresReview`.
- `ScheduledAutomationState`: `{ automations, runs, inbox }`.
- `DEFAULT_SCHEDULED_AUTOMATION_STATE`.
- `isScheduledAutomationState(value)`.
- `projectDueScheduledAutomations({ state, now })`.
- `recordScheduledAutomationRun({ state, automationId, run, now })`.
- `buildScheduledAutomationInbox(state)`.

Cadence values are `once`, `hourly`, `daily`, and `weekly`. `nextRunAt` is ISO time. `projectDueScheduledAutomations` returns enabled automations whose `nextRunAt` is at or before `now`; disabled or invalid schedules are ignored. `recordScheduledAutomationRun` updates run history, recomputes the automation's next run, and creates inbox entries for failed runs or runs that explicitly require review.

### Persistence

Add `STORAGE_KEYS.scheduledAutomationsState = 'agent-browser.scheduled-automations-state'` and persist through `useStoredState(localStorageBackend, STORAGE_KEYS.scheduledAutomationsState, isScheduledAutomationState, DEFAULT_SCHEDULED_AUTOMATION_STATE)`.

The state validator must reject malformed automations, invalid cadence values, non-array history/inbox fields, and invalid retry/notification settings. Loading bad data should fall back without crashing.

### UI Behavior

History gets a "Scheduled automations" section above recent activity showing:

- total enabled schedules
- due-now count
- next scheduled run
- latest run evidence summary
- review inbox count

Settings gets a collapsible "Scheduled automations" section showing:

- enable/disable controls for seeded schedules
- cadence select
- retry count select
- notification route select
- review trigger select

The first iteration seeds two practical schedules: "Daily workspace audit" and "Weekly verification sweep". The UI is dense, mobile-first, keyboard accessible, and uses existing SettingsSection, SidebarSection, provider-card/list-card, badge, chip, select, and checkbox-row styles.

### Browser Validation

`visual-smoke.mjs` opens History and verifies the scheduled automations summary, then opens Settings and verifies the controls. It must save the normal visual smoke screenshot and the PR should include a copied screenshot under this plan directory.

## One-Shot LLM Prompt

You are implementing TK-22 in `C:\Users\conta\.codex\worktrees\8a30\agent-harness`.

Add scheduled browser automations to Agent Browser. Create a pure TypeScript scheduler service at `agent-browser/src/services/scheduledAutomations.ts` with default seeded schedules, strict state validation, due-run projection, run recording, retry/notification/review policy handling, and inbox derivation. Persist the scheduler state with `STORAGE_KEYS.scheduledAutomationsState`. Render a Scheduled automations section in History with enabled, due, next-run, latest-evidence, and inbox summaries. Render a Scheduled automations Settings section with accessible enable, cadence, retry, notification, and review controls. Add Vitest service tests first, then storage and App smoke tests, then visual-smoke script assertions. Run focused checks, `npm.cmd run verify:agent-browser`, and copy `output/playwright/agent-browser-visual-smoke.png` to `docs/superpowers/plans/2026-05-06-scheduled-browser-automations-visual-smoke.png` for PR evidence.

## TDD Tasks

### Task 1: Pure Scheduler Service

**Files:**
- Create: `agent-browser/src/services/scheduledAutomations.test.ts`
- Create: `agent-browser/src/services/scheduledAutomations.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCHEDULED_AUTOMATION_STATE,
  buildScheduledAutomationInbox,
  isScheduledAutomationState,
  projectDueScheduledAutomations,
  recordScheduledAutomationRun,
} from './scheduledAutomations';

describe('scheduledAutomations', () => {
  it('projects only enabled schedules due at or before the current time', () => {
    const due = projectDueScheduledAutomations({
      state: DEFAULT_SCHEDULED_AUTOMATION_STATE,
      now: new Date('2026-05-06T18:00:00.000Z'),
    });

    expect(due.map((automation) => automation.id)).toContain('daily-workspace-audit');
    expect(due.every((automation) => automation.enabled)).toBe(true);
  });

  it('records run evidence, advances recurring schedules, and creates review inbox entries', () => {
    const next = recordScheduledAutomationRun({
      state: DEFAULT_SCHEDULED_AUTOMATION_STATE,
      automationId: 'daily-workspace-audit',
      now: new Date('2026-05-06T18:00:00.000Z'),
      run: {
        status: 'failed',
        summary: 'Workspace audit found stale browser evidence.',
        evidence: ['visual smoke stale'],
        requiresReview: true,
      },
    });

    expect(next.runs[0]).toMatchObject({
      automationId: 'daily-workspace-audit',
      status: 'failed',
      attempt: 1,
      requiresReview: true,
    });
    expect(next.automations.find((entry) => entry.id === 'daily-workspace-audit')?.nextRunAt).toBe('2026-05-07T18:00:00.000Z');
    expect(buildScheduledAutomationInbox(next)[0]?.title).toBe('Daily workspace audit needs review');
  });

  it('accepts only valid persisted scheduler state', () => {
    expect(isScheduledAutomationState(DEFAULT_SCHEDULED_AUTOMATION_STATE)).toBe(true);
    expect(isScheduledAutomationState({ automations: [{ cadence: 'sometimes' }], runs: [], inbox: [] })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/services/scheduledAutomations.test.ts`

Expected: FAIL because `scheduledAutomations` does not exist.

- [ ] **Step 3: Implement the service**

Create the exported types, defaults, validators, due projection, run recording, and inbox builder.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/services/scheduledAutomations.test.ts`

Expected: PASS.

### Task 2: Persist Scheduler State

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/services/sessionState.test.ts`

- [ ] **Step 1: Write failing storage test**

Add `scheduledAutomationsState: expect.any(String)` to the storage-key category test.

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/services/sessionState.test.ts -t "lists the categories"`

Expected: FAIL because the key is missing.

- [ ] **Step 3: Add storage key**

Add `scheduledAutomationsState: 'agent-browser.scheduled-automations-state'`.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/services/sessionState.test.ts -t "lists the categories"`

Expected: PASS.

### Task 3: Render History and Settings Surfaces

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/src/App.smoke.test.tsx`

- [ ] **Step 1: Write failing App smoke test**

Add a test that opens History and sees "Scheduled automations", then opens Settings, expands "Scheduled automations", and verifies "Enable Daily workspace audit", "Daily workspace audit cadence", "Daily workspace audit retry count", "Daily workspace audit notification route", and "Daily workspace audit review trigger".

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx -t "scheduled automations"`

Expected: FAIL because the panels do not render scheduler state.

- [ ] **Step 3: Implement UI**

Hydrate scheduler state in `App`, pass it into `HistoryPanel` and `SettingsPanel`, update schedules through `setScheduledAutomationState`, and add compact CSS for `.scheduled-automations-*`.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx -t "scheduled automations"`

Expected: PASS.

### Task 4: Visual Smoke and Script Coverage

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Modify: `agent-browser/scripts/run-script-tests.mjs`

- [ ] **Step 1: Write failing script-test assertion**

Add `run-script-tests.mjs` checks that `visual-smoke.mjs` asserts "Scheduled automations" and "Enable Daily workspace audit".

- [ ] **Step 2: Run script tests to verify RED**

Run: `npm.cmd --workspace agent-browser run test:scripts`

Expected: FAIL until visual smoke is updated.

- [ ] **Step 3: Update visual smoke**

Visit History, assert scheduled automations summary, visit Settings, expand Scheduled automations, and assert the controls.

- [ ] **Step 4: Run script tests to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test:scripts`

Expected: PASS.

### Task 5: Full Verification and PR

- [ ] **Step 1: Run focused checks**

```powershell
npm.cmd --workspace agent-browser run test -- src/services/scheduledAutomations.test.ts
npm.cmd --workspace agent-browser run test -- src/services/sessionState.test.ts -t "lists the categories"
npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx -t "scheduled automations"
npm.cmd --workspace agent-browser run test:scripts
```

- [ ] **Step 2: Run full Agent Browser verifier**

Run: `npm.cmd run verify:agent-browser`

Expected: generated-file check, eval validation/tests, script tests, extension checks, Agent Browser lint/coverage/build, audit, and visual smoke pass.

- [ ] **Step 3: Copy visual evidence**

Copy `output/playwright/agent-browser-visual-smoke.png` to `docs/superpowers/plans/2026-05-06-scheduled-browser-automations-visual-smoke.png`.

- [ ] **Step 4: Publish**

Create branch `codex/tk-22-scheduled-browser-automations`, commit, push, open PR, label `codex` and `codex-automation`, link the PR to TK-22, and move TK-22 to Done after verification.

## Self-Review

Spec coverage: The plan covers scheduled one-off and recurring automations, history, evidence, retry controls, notification routing, and review inbox state. Execution is represented as deterministic run records in this iteration so the UI and persistence are complete without adding a background worker daemon.

Placeholder scan: No task relies on TBD or later implementation. Each task has explicit files, commands, and expected behavior.

Type consistency: The plan uses `ScheduledAutomationState`, `ScheduledAutomation`, `ScheduledAutomationRun`, `scheduledAutomationsState`, and the seeded schedule IDs consistently across service, storage, UI, tests, and visual smoke.
