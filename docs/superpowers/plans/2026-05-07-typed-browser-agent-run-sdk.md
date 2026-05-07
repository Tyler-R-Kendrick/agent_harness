# Typed Browser Agent Run SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose Agent Browser runs through a typed, durable SDK surface that can create runs, stream structured lifecycle events, reconnect from an event cursor, and cancel/archive/delete runs without driving the UI.

**Architecture:** Add a pure `browserAgentRunSdk` service that owns the run state contract, validation, event projection, and client operations. Persist the SDK state through `sessionState`, surface it in History and Settings, and keep the app integration shallow so future local/remote transports can reuse the same typed client.

**Tech Stack:** React, TypeScript, Vitest, localStorage-backed session persistence, existing Agent Browser Settings/History panels, Playwright visual smoke.

---

## Feature Implementation Plan

TK-36 asks for a public runtime shape for browser-agent runs. The first shippable slice is a browser-native SDK contract and durable run registry with lifecycle controls. It does not replace the active chat runner yet; it creates a stable seam other tools can import and later wire to server/SSE transports.

The feature includes:

- `createBrowserAgentRunSdk(state)` with typed methods for `createRun`, `appendRunEvent`, `streamRunEvents`, `reconnectRun`, `cancelRun`, `archiveRun`, and `deleteRun`.
- Structured run events with monotonically increasing sequence numbers for reconnect cursors.
- Durable state validation for persisted runs.
- History panel summary cards showing active/durable SDK runs and lifecycle evidence.
- Settings panel status showing public SDK capabilities and retention posture.
- Regression coverage for lifecycle, reconnect, validation, App smoke, script checks, and visual smoke strings.

## Architecture-Aligned Technical Spec

### Data Model

Create `agent-browser/src/services/browserAgentRunSdk.ts`:

```ts
export type BrowserAgentRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled' | 'archived' | 'deleted';
export type BrowserAgentRunMode = 'local' | 'remote';
export type BrowserAgentRunEventType = 'created' | 'started' | 'message' | 'tool' | 'checkpoint' | 'completed' | 'failed' | 'canceled' | 'archived' | 'deleted';

export interface BrowserAgentRun {
  id: string;
  title: string;
  sessionId: string;
  workspaceId: string;
  prompt: string;
  mode: BrowserAgentRunMode;
  status: BrowserAgentRunStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  eventCursor: number;
}

export interface BrowserAgentRunEvent {
  id: string;
  runId: string;
  sequence: number;
  type: BrowserAgentRunEventType;
  createdAt: string;
  summary: string;
  payload?: Record<string, unknown>;
}

export interface BrowserAgentRunSdkState {
  runs: BrowserAgentRun[];
  events: BrowserAgentRunEvent[];
}
```

### SDK Behavior

- `createRun` appends a run with `queued` status and a `created` event.
- `appendRunEvent` updates run status for terminal/control event types and increments the cursor.
- `streamRunEvents({ runId, after })` returns events with `sequence > after` for reconnect-safe streaming.
- `reconnectRun({ runId, cursor })` returns the run and missed events after the cursor.
- `cancelRun`, `archiveRun`, and `deleteRun` append lifecycle events and update status/timestamps.
- `deleteRun` keeps a tombstone run and removes non-delete event history for that run from active streams.
- Validators reject malformed persisted records so bad localStorage cannot crash the app.

### UI Integration

- Add `STORAGE_KEYS.browserAgentRunSdkState`.
- Hydrate SDK state in `AgentBrowserApp` with `useStoredState`.
- Add `BrowserAgentRunSdkHistory` inside History above scheduled automations.
- Add `BrowserAgentRunSdkSettingsPanel` inside Settings near partner/runtime controls.
- Seed a default local SDK run so the feature is visible in the current shell and visual smoke can validate it.

### Testing And Verification

- Focused service tests must prove run creation, lifecycle controls, reconnect streaming, delete tombstones, and persisted-state validation.
- App smoke test must render the History run SDK card and Settings SDK capability panel.
- `run-script-tests.mjs` and `visual-smoke.mjs` must assert the feature strings so repo gates catch accidental removal.
- Required final gate: `npm run verify:agent-browser`.

## One-Shot LLM Prompt

You are implementing TK-36 in `agent-browser`. Add a typed browser-agent run SDK and durable run API. Create a pure service in `agent-browser/src/services/browserAgentRunSdk.ts` with exported types, default state, validators, and a deterministic SDK client exposing `createRun`, `appendRunEvent`, `streamRunEvents`, `reconnectRun`, `cancelRun`, `archiveRun`, and `deleteRun`. Persist the SDK state through `sessionState` with a new storage key. Wire the App so History shows durable SDK runs and lifecycle evidence, while Settings shows SDK capabilities for typed launch, structured streaming, reconnect, cancellation, archive, and deletion. Use TDD: write the service test first, watch it fail, implement the service, then add App smoke/visual/script coverage. Keep UI mobile-friendly and accessible, using existing sidebar/settings patterns and no backend server unless an existing transport seam already makes that trivial. Finish by running `npm run verify:agent-browser`, saving visual evidence, committing, pushing, opening a PR, adding `codex` and `codex-automation` labels, and moving TK-36 to Done.

## File Structure

- Create: `agent-browser/src/services/browserAgentRunSdk.ts` for the typed SDK state, validators, lifecycle reducer, stream/reconnect helpers, and client factory.
- Create: `agent-browser/src/services/browserAgentRunSdk.test.ts` for TDD coverage of SDK behavior.
- Modify: `agent-browser/src/services/sessionState.ts` to add the storage key.
- Modify: `agent-browser/src/App.tsx` to hydrate SDK state and render History/Settings surfaces.
- Modify: `agent-browser/src/App.smoke.test.tsx` to cover the new UI.
- Modify: `agent-browser/scripts/visual-smoke.mjs` to validate and screenshot the SDK surfaces.
- Modify: `agent-browser/scripts/run-script-tests.mjs` to assert the visual smoke coverage remains checked in.

## TDD Task Plan

### Task 1: SDK Service

**Files:**
- Create: `agent-browser/src/services/browserAgentRunSdk.test.ts`
- Create: `agent-browser/src/services/browserAgentRunSdk.ts`

- [ ] **Step 1: Write the failing service tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BROWSER_AGENT_RUN_SDK_STATE,
  createBrowserAgentRunSdk,
  isBrowserAgentRunSdkState,
} from './browserAgentRunSdk';

describe('browserAgentRunSdk', () => {
  it('creates typed durable runs and streams missed events by cursor', () => {
    const sdk = createBrowserAgentRunSdk(DEFAULT_BROWSER_AGENT_RUN_SDK_STATE, {
      now: () => new Date('2026-05-07T12:00:00.000Z'),
      id: (prefix) => `${prefix}-1`,
    });

    const created = sdk.createRun({ title: 'SDK smoke run', sessionId: 's1', workspaceId: 'ws1', prompt: 'test', mode: 'local' });
    const started = createBrowserAgentRunSdk(created.state).appendRunEvent(created.run.id, { type: 'started', summary: 'Runtime accepted run.' });
    const message = createBrowserAgentRunSdk(started.state).appendRunEvent(created.run.id, { type: 'message', summary: 'Agent streamed output.', payload: { chunk: 'hello' } });

    expect(message.run.status).toBe('running');
    expect(message.event.sequence).toBe(3);
    expect(createBrowserAgentRunSdk(message.state).streamRunEvents({ runId: created.run.id, after: 1 }).map((event) => event.type)).toEqual(['started', 'message']);
  });

  it('supports reconnect, cancellation, archive, and delete tombstones', () => {
    const sdk = createBrowserAgentRunSdk(DEFAULT_BROWSER_AGENT_RUN_SDK_STATE, {
      now: () => new Date('2026-05-07T12:00:00.000Z'),
      id: (prefix) => `${prefix}-2`,
    });
    const created = sdk.createRun({ title: 'Remote run', sessionId: 's2', workspaceId: 'ws1', prompt: 'remote', mode: 'remote' });
    const canceled = createBrowserAgentRunSdk(created.state).cancelRun(created.run.id, 'Operator canceled from SDK.');
    const archived = createBrowserAgentRunSdk(canceled.state).archiveRun(created.run.id, 'Archived after review.');
    const deleted = createBrowserAgentRunSdk(archived.state).deleteRun(created.run.id, 'Deleted by lifecycle API.');

    expect(deleted.run.status).toBe('deleted');
    expect(deleted.run.deletedAt).toBe('2026-05-07T12:00:00.000Z');
    expect(createBrowserAgentRunSdk(deleted.state).reconnectRun({ runId: created.run.id, cursor: 0 })?.events.map((event) => event.type)).toEqual(['deleted']);
  });

  it('validates only well-formed persisted SDK state', () => {
    expect(isBrowserAgentRunSdkState(DEFAULT_BROWSER_AGENT_RUN_SDK_STATE)).toBe(true);
    expect(isBrowserAgentRunSdkState({ runs: [{ status: 'maybe' }], events: [] })).toBe(false);
    expect(isBrowserAgentRunSdkState({ runs: [], events: 'bad' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test -- src/services/browserAgentRunSdk.test.ts`

Expected: FAIL because `browserAgentRunSdk` does not exist.

- [ ] **Step 3: Implement the minimal SDK service**

Create the exported types, default state, validators, and pure lifecycle methods described above.

- [ ] **Step 4: Run focused test to verify it passes**

Run: `npm.cmd --workspace agent-browser run test -- src/services/browserAgentRunSdk.test.ts`

Expected: PASS with 100% coverage for the service file.

### Task 2: Persistence And UI

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.smoke.test.tsx`

- [ ] **Step 1: Write failing App smoke coverage**

Add an App smoke test that opens History and Settings and expects:

```ts
expect(screen.getByRole('button', { name: 'Typed run SDK' })).toBeInTheDocument();
expect(screen.getByText('SDK launch smoke')).toBeInTheDocument();
expect(screen.getByText('Structured event stream')).toBeInTheDocument();
expect(screen.getByText('Reconnect cursor')).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx`

Expected: FAIL because the panels do not render the SDK surface.

- [ ] **Step 3: Wire state and UI**

Add `browserAgentRunSdkState` to localStorage, render a History card with run/event counts, and render a Settings panel with capability chips for launch, stream, reconnect, cancel, archive, delete.

- [ ] **Step 4: Run App smoke coverage**

Run: `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx`

Expected: PASS.

### Task 3: Repo Gates And Visual Review

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Modify: `agent-browser/scripts/run-script-tests.mjs`

- [ ] **Step 1: Add script assertions**

Assert `visual-smoke.mjs` includes `Typed run SDK`, `Structured event stream`, and the screenshot path for SDK visual evidence.

- [ ] **Step 2: Run script tests**

Run: `npm.cmd --workspace agent-browser run test:scripts`

Expected: PASS.

- [ ] **Step 3: Run visual smoke**

Run: `npm.cmd run visual:agent-browser`

Expected: PASS and screenshot at `output/playwright/agent-browser-visual-smoke.png`.

- [ ] **Step 4: Run full verification**

Run: `npm.cmd run verify:agent-browser`

Expected: PASS across generated-file check, evals, scripts, lint, coverage, build, audit, and visual smoke.

## Self-Review

- Spec coverage: run launch, typed events, reconnect, cancellation, archive, delete, durable state, and UI visibility are covered.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: `BrowserAgentRunSdkState`, `BrowserAgentRun`, and `BrowserAgentRunEvent` names are stable across tests, service, persistence, and UI.
