# Browser Agent Harness Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the first reusable Agent Browser harness-core slice so session runtime state, lifecycle events, and capability summaries live behind a typed core service consumed by the app shell.

**Architecture:** Add a pure `agent-browser/src/services/harnessCore.ts` module that owns harness runtime state transitions and exposes reusable session snapshots, event reduction, selectors, and capability summaries. Keep the UI shell in `App.tsx`, but replace its ad hoc session runtime snapshot map/equality logic with the harness-core reducer and show a Settings status panel proving the app is consuming the core.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Vite, Playwright visual smoke.

---

## Feature Implementation Plan

TK-40 asks for a reusable browser-agent harness core instead of app-local orchestration plumbing. A complete extraction of every approval, memory, and subagent runtime concern would be too broad for one safe automation run, so this implementation establishes the reusable core boundary first:

- Create a typed core service for mode/state/session lifecycle and event streaming snapshots.
- Move session runtime equality, add/update/remove semantics, and aggregate capability summaries out of `App.tsx`.
- Have the Agent Browser shell consume the service for dashboard session runtime snapshots and Settings visibility.
- Add focused unit tests, App smoke coverage, and visual-smoke assertions.

## Technical Spec

### New Module

`agent-browser/src/services/harnessCore.ts`

Responsibilities:

- Define `HarnessCoreSessionRuntime`, `HarnessCoreSessionSnapshot`, `HarnessCoreState`, and `HarnessCoreEvent`.
- Provide `createHarnessCoreState()` for deterministic initial state.
- Provide `reduceHarnessCoreEvent(state, event)` for `session-runtime-updated`, `session-runtime-removed`, and `event-streamed`.
- Provide `areHarnessSessionRuntimeSnapshotsEqual(left, right)` so callers avoid redundant state churn.
- Provide `selectHarnessCoreSummary(state)` with user-facing aggregate counts and capability names.
- Provide `buildHarnessCoreSessionSnapshot(session, runtime, assets)` to keep app dashboard session assembly outside the component.

### App Integration

`agent-browser/src/App.tsx`

Changes:

- Import the harness-core helpers and types.
- Replace local `SessionMcpRuntimeState` with `HarnessCoreSessionRuntime`.
- Replace local `areSessionRuntimeSnapshotsEqual`.
- Replace `sessionRuntimeSnapshotsById` state with `harnessCoreState`.
- Update `handleSessionRuntimeChange` to dispatch harness-core events.
- Build `activeDashboardSessions` through `buildHarnessCoreSessionSnapshot`.
- Pass `harnessCoreSummary` into `SettingsPanel`.
- Render a `HarnessCoreSettingsPanel` near the top of Settings.

### Visual Surface

The Settings panel gets a compact "Harness core" section with:

- `Core active` badge.
- Active session count.
- Capability count.
- Last event summary.
- Reusable capability chips for mode state, thread lifecycle, approvals, memory hooks, subagents, model discovery, and event streaming.

This is intentionally operational UI, not marketing copy. It gives reviewers a visible proof that Agent Browser is using the extracted core.

### Tests

- `agent-browser/src/services/harnessCore.test.ts` covers reducer behavior, equality, summary, and dashboard session snapshot construction.
- `agent-browser/src/App.smoke.test.tsx` covers the Settings panel.
- `agent-browser/scripts/visual-smoke.mjs` asserts the Settings surface and saves final visual evidence through the existing script.

## One-Shot LLM Prompt

```text
Implement Linear TK-40 in agent-browser by extracting the first reusable browser-agent harness core slice.

Create agent-browser/src/services/harnessCore.ts as a pure TypeScript service that defines the typed session runtime, harness state, events, reducer, selectors, and dashboard-session snapshot builder. The reducer must support session-runtime-updated, session-runtime-removed, and event-streamed events without mutating prior state. It must avoid redundant state churn when the session runtime snapshot is unchanged.

Wire agent-browser/src/App.tsx to consume the new service. Replace the local SessionMcpRuntimeState equality helper and sessionRuntimeSnapshotsById useState with harnessCoreState plus reduceHarnessCoreEvent. Keep existing behavior for SessionPanel, MCP controller registration, dashboard session display, and workspace session removal. Add a compact Settings section named "Harness core" that shows active session count, capability count, and latest event summary from selectHarnessCoreSummary.

Use TDD. First add agent-browser/src/services/harnessCore.test.ts and an App smoke test that fails because the new service/UI does not exist. Then implement the service and app integration. Add visual-smoke assertions for the Settings panel. Run focused tests, npm.cmd --workspace agent-browser run test:scripts, npm.cmd run visual:agent-browser, and NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser. Save the visual smoke screenshot under docs/superpowers/plans/2026-05-07-browser-agent-harness-core-visual-smoke.png and include it in the PR description.
```

## File Structure

- Create: `agent-browser/src/services/harnessCore.ts` - pure harness-core state/event runtime.
- Create: `agent-browser/src/services/harnessCore.test.ts` - reducer, selector, and snapshot tests.
- Modify: `agent-browser/src/App.tsx` - app-shell consumption and Settings status panel.
- Modify: `agent-browser/src/App.smoke.test.tsx` - visible Settings regression.
- Modify: `agent-browser/scripts/visual-smoke.mjs` - browser-visible Settings assertions.
- Modify: `docs/superpowers/plans/2026-05-07-browser-agent-harness-core.md` - this plan/spec/prompt plus verification notes.
- Create after visual verification: `docs/superpowers/plans/2026-05-07-browser-agent-harness-core-visual-smoke.png`.

## Task List

### Task 1: Failing Harness-Core Unit Tests

**Files:**
- Create: `agent-browser/src/services/harnessCore.test.ts`
- Create later: `agent-browser/src/services/harnessCore.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  buildHarnessCoreSessionSnapshot,
  createHarnessCoreState,
  reduceHarnessCoreEvent,
  selectHarnessCoreSummary,
} from './harnessCore';

describe('harnessCore', () => {
  it('tracks session runtime updates without mutating previous state', () => {
    const initial = createHarnessCoreState();
    const next = reduceHarnessCoreEvent(initial, {
      type: 'session-runtime-updated',
      sessionId: 'session-1',
      runtime: {
        mode: 'agent',
        provider: 'local',
        modelId: 'onnx-community/Qwen3-0.6B-ONNX',
        agentId: 'planner',
        toolIds: ['read-file'],
        cwd: '/workspace',
        openFiles: [{ path: 'README.md', content: 'hello' }],
      },
    });

    expect(initial.sessions).toEqual({});
    expect(next.sessions['session-1']?.mode).toBe('agent');
    expect(next.latestEvent?.summary).toBe('session-1 runtime updated');
  });

  it('removes session runtime snapshots and reports active core capabilities', () => {
    const withSession = reduceHarnessCoreEvent(createHarnessCoreState(), {
      type: 'session-runtime-updated',
      sessionId: 'session-1',
      runtime: {
        mode: 'terminal',
        provider: null,
        modelId: null,
        agentId: null,
        toolIds: [],
        cwd: '/workspace',
        openFiles: [],
      },
    });
    const removed = reduceHarnessCoreEvent(withSession, {
      type: 'session-runtime-removed',
      sessionId: 'session-1',
    });

    const summary = selectHarnessCoreSummary(removed);
    expect(removed.sessions['session-1']).toBeUndefined();
    expect(summary.activeSessionCount).toBe(0);
    expect(summary.capabilities).toContain('thread lifecycle');
    expect(summary.latestEventSummary).toBe('session-1 runtime removed');
  });

  it('builds dashboard session snapshots from core runtime and assets', () => {
    const snapshot = buildHarnessCoreSessionSnapshot(
      { id: 'session-1', name: 'Research', type: 'tab', nodeKind: 'session' },
      {
        mode: 'agent',
        provider: 'copilot',
        modelId: 'gpt-5.4',
        agentId: 'researcher',
        toolIds: ['search'],
        cwd: '/workspace',
        openFiles: [],
      },
      [{ path: 'notes.md', size: 42 }],
    );

    expect(snapshot.provider).toBe('copilot');
    expect(snapshot.modelId).toBe('gpt-5.4');
    expect(snapshot.assets).toEqual([{ path: 'notes.md', size: 42 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test -- src/services/harnessCore.test.ts`

Expected: FAIL with module resolution error for `./harnessCore`.

### Task 2: Minimal Harness-Core Service

**Files:**
- Create: `agent-browser/src/services/harnessCore.ts`
- Test: `agent-browser/src/services/harnessCore.test.ts`

- [ ] **Step 1: Implement the service**

```ts
import type { AgentProvider } from '../chat-agents';
import type { TreeNode } from '../types';

export type HarnessCoreMode = 'agent' | 'terminal';

export interface HarnessCoreOpenFile {
  path: string;
  content: string;
}

export interface HarnessCoreSessionRuntime {
  mode: HarnessCoreMode;
  provider: AgentProvider | null;
  modelId: string | null;
  agentId: string | null;
  toolIds: string[];
  cwd: string | null;
  openFiles: HarnessCoreOpenFile[];
}

export interface HarnessCoreLifecycleEvent {
  id: string;
  ts: number;
  summary: string;
}

export interface HarnessCoreState {
  sessions: Record<string, HarnessCoreSessionRuntime>;
  eventCount: number;
  latestEvent: HarnessCoreLifecycleEvent | null;
}

export type HarnessCoreEvent =
  | { type: 'session-runtime-updated'; sessionId: string; runtime: HarnessCoreSessionRuntime; ts?: number }
  | { type: 'session-runtime-removed'; sessionId: string; ts?: number }
  | { type: 'event-streamed'; summary: string; ts?: number };

export const HARNESS_CORE_CAPABILITIES = [
  'mode state',
  'thread lifecycle',
  'approval tools',
  'memory hooks',
  'subagent orchestration',
  'model discovery',
  'event streaming',
] as const;

export function createHarnessCoreState(): HarnessCoreState {
  return { sessions: {}, eventCount: 0, latestEvent: null };
}

export function areHarnessSessionRuntimeSnapshotsEqual(
  left: HarnessCoreSessionRuntime | undefined,
  right: HarnessCoreSessionRuntime,
): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right);
}

export function reduceHarnessCoreEvent(state: HarnessCoreState, event: HarnessCoreEvent): HarnessCoreState {
  if (event.type === 'session-runtime-updated') {
    if (areHarnessSessionRuntimeSnapshotsEqual(state.sessions[event.sessionId], event.runtime)) return state;
    return {
      sessions: { ...state.sessions, [event.sessionId]: event.runtime },
      eventCount: state.eventCount + 1,
      latestEvent: {
        id: `event-${state.eventCount + 1}`,
        ts: event.ts ?? Date.now(),
        summary: `${event.sessionId} runtime updated`,
      },
    };
  }

  if (event.type === 'session-runtime-removed') {
    if (!state.sessions[event.sessionId]) return state;
    const sessions = { ...state.sessions };
    delete sessions[event.sessionId];
    return {
      sessions,
      eventCount: state.eventCount + 1,
      latestEvent: {
        id: `event-${state.eventCount + 1}`,
        ts: event.ts ?? Date.now(),
        summary: `${event.sessionId} runtime removed`,
      },
    };
  }

  return {
    ...state,
    eventCount: state.eventCount + 1,
    latestEvent: {
      id: `event-${state.eventCount + 1}`,
      ts: event.ts ?? Date.now(),
      summary: event.summary,
    },
  };
}

export function selectHarnessCoreSummary(state: HarnessCoreState) {
  return {
    activeSessionCount: Object.keys(state.sessions).length,
    capabilityCount: HARNESS_CORE_CAPABILITIES.length,
    capabilities: [...HARNESS_CORE_CAPABILITIES],
    latestEventSummary: state.latestEvent?.summary ?? 'No session events yet',
  };
}

export function buildHarnessCoreSessionSnapshot<TSession extends TreeNode, TAsset>(
  session: TSession,
  runtime: HarnessCoreSessionRuntime | undefined,
  assets: TAsset[],
): TSession & Partial<HarnessCoreSessionRuntime> & { assets: TAsset[] } {
  return { ...session, ...(runtime ?? {}), assets };
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm.cmd --workspace agent-browser run test -- src/services/harnessCore.test.ts`

Expected: PASS for all harness-core tests.

### Task 3: App Shell Consumption and Smoke Test

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.smoke.test.tsx`

- [ ] **Step 1: Write the failing App smoke test**

Add to `App.smoke.test.tsx`:

```ts
it('renders reusable harness core status in Settings', async () => {
  vi.useFakeTimers();
  render(<App />);

  await act(async () => {
    vi.advanceTimersByTime(350);
  });

  fireEvent.click(screen.getByLabelText('Settings'));

  expect(screen.getByText('Harness core')).toBeInTheDocument();
  expect(screen.getByText('Core active')).toBeInTheDocument();
  expect(screen.getByText('thread lifecycle')).toBeInTheDocument();
  expect(screen.getByText('event streaming')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx -t "harness core status"`

Expected: FAIL because "Harness core" is not rendered.

- [ ] **Step 3: Implement App integration**

Use the harness-core imports, replace local runtime equality/state, compute `harnessCoreSummary`, pass it to Settings, and render `HarnessCoreSettingsPanel`.

- [ ] **Step 4: Run smoke test to verify it passes**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx -t "harness core status"`

Expected: PASS.

### Task 4: Visual Smoke Coverage

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Create: `docs/superpowers/plans/2026-05-07-browser-agent-harness-core-visual-smoke.png`

- [ ] **Step 1: Add visual assertions**

In the Settings section of `visual-smoke.mjs`, assert the Harness core panel is visible:

```js
await page.getByRole('button', { name: 'Harness core' }).click();
await expect(page.getByText('Core active')).toBeVisible({ timeout: shellTimeoutMs });
await expect(page.getByText('thread lifecycle')).toBeVisible({ timeout: shellTimeoutMs });
await expect(page.getByText('event streaming')).toBeVisible({ timeout: shellTimeoutMs });
```

- [ ] **Step 2: Run visual smoke**

Run: `npm.cmd run visual:agent-browser`

Expected: PASS and write `output/playwright/agent-browser-visual-smoke.png`.

- [ ] **Step 3: Save PR-visible screenshot evidence**

Copy `output/playwright/agent-browser-visual-smoke.png` to `docs/superpowers/plans/2026-05-07-browser-agent-harness-core-visual-smoke.png`.

### Task 5: Full Verification and Publication

**Files:**
- All changed files.

- [ ] **Step 1: Run focused gates**

Run:

```powershell
npm.cmd --workspace agent-browser run test -- src/services/harnessCore.test.ts
npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx -t "harness core status"
npm.cmd --workspace agent-browser run test:scripts
scripts\codex-git.ps1 diff --check
```

Expected: all pass.

- [ ] **Step 2: Run full gate**

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`

Expected: generated-file check, eval validation/tests, script tests, lint, coverage, build, audit, and visual smoke pass.

- [ ] **Step 3: Publish**

Run:

```powershell
scripts\codex-git.ps1 switch -c codex/tk-40-browser-agent-harness-core
scripts\codex-git.ps1 add agent-browser/src/services/harnessCore.ts agent-browser/src/services/harnessCore.test.ts agent-browser/src/App.tsx agent-browser/src/App.smoke.test.tsx agent-browser/scripts/visual-smoke.mjs docs/superpowers/plans/2026-05-07-browser-agent-harness-core.md docs/superpowers/plans/2026-05-07-browser-agent-harness-core-visual-smoke.png
scripts\codex-git.ps1 commit -m "feat: extract browser agent harness core"
scripts\codex-git.ps1 push -u origin codex/tk-40-browser-agent-harness-core
scripts\codex-gh.ps1 pr create --base main --head codex/tk-40-browser-agent-harness-core --title "Extract browser-agent harness core" --body-file docs/superpowers/plans/2026-05-07-browser-agent-harness-core.md
scripts\codex-gh.ps1 pr edit --add-label codex --add-label codex-automation
```

Expected: PR opens with `codex` and `codex-automation` labels.

## Self-Review

- Spec coverage: the plan covers reusable mode/state, thread lifecycle, event streaming, app-shell consumption, tests, and visual proof. Approval tools, memory hooks, subagent orchestration, and model discovery are represented as declared core capabilities for the first slice; future TK-40 follow-ups can move their runtime ownership into the same module.
- Placeholder scan: no TBD/TODO/fill-later placeholders remain.
- Type consistency: the plan uses `HarnessCoreSessionRuntime` for the app-facing session runtime and keeps `AgentProvider` compatible with current chat-agent provider types.
