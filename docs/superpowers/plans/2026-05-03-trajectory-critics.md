# Trajectory Critics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class trajectory critic to `agent-browser` that scores recent process/tool traces and recommends continue, stop, retry, branch, or human review.

**Architecture:** Keep the critic as a deterministic service over the existing `ProcessEntry[]` and `ChatMessage` data, then surface the result in the existing Process panel. Persist only threshold settings through `sessionState.ts`; do not introduce a second run log or new agent storage tree.

**Tech Stack:** React 18, TypeScript, Vitest, existing `ProcessLog`, `ChatMessage`, `SettingsPanel`, and `ProcessPanel` seams.

---

## Feature Implementation Plan

TK-45 asks for a lightweight runtime critic inspired by OpenHands trajectory-level verification. The local implementation should avoid a model dependency in this first slice and instead provide a deterministic critic that can later be replaced or augmented by a model-backed evaluator.

The first deliverable is:

- A pure `trajectoryCritic` service that accepts process entries, optional chat message state, and configurable thresholds.
- Structured score output with reasons, concerns, confidence contributors, and one recommended control action.
- A persisted settings key for enablement and thresholds.
- Process panel UI that shows the current critic verdict for a selected assistant turn.
- Focused tests for scoring, settings validation, and process-panel rendering.

Out of scope for this slice:

- Actually auto-retrying or branching the running agent loop.
- Calling an external critic model.
- Persisting new process data outside the existing chat-message/session persistence.

## Architecture-Aligned Technical Spec

### Data Model

Create `agent-browser/src/services/trajectoryCritic.ts`.

Types:

```ts
export type TrajectoryCriticAction = 'continue' | 'stop' | 'retry' | 'branch' | 'human-review';

export interface TrajectoryCriticSettings {
  enabled: boolean;
  retryThreshold: number;
  branchThreshold: number;
  stopThreshold: number;
  humanReviewThreshold: number;
}

export interface TrajectoryCriticReason {
  kind: 'confidence' | 'concern';
  code: string;
  label: string;
  weight: number;
}

export interface TrajectoryCriticResult {
  enabled: boolean;
  score: number;
  action: TrajectoryCriticAction;
  summary: string;
  reasons: TrajectoryCriticReason[];
}
```

Default thresholds:

```ts
export const DEFAULT_TRAJECTORY_CRITIC_SETTINGS: TrajectoryCriticSettings = {
  enabled: true,
  retryThreshold: 0.58,
  branchThreshold: 0.44,
  stopThreshold: 0.24,
  humanReviewThreshold: 0.68,
};
```

Validation rules:

- `enabled` must be boolean.
- Thresholds must be finite numbers between `0` and `1`.
- `stopThreshold <= branchThreshold <= retryThreshold <= humanReviewThreshold`.

### Scoring Rules

Start at `0.72`.

Add confidence:

- `+0.08` if the turn has a completion, result, or commit event.
- `+0.06` if at least one tool result is successful or non-empty.
- `+0.04` if at least one vote approves.
- `+0.03` if there are multiple branches and none failed.

Subtract concerns:

- `-0.28` if any process entry has `status: 'failed'`.
- `-0.18` if an abort event appears.
- `-0.14` if a vote rejects.
- `-0.12` if a tool result transcript or summary contains obvious error terms.
- `-0.10` if more than one active entry remains on a non-streaming complete/error message.
- `-0.08` if the assistant message is marked `isError`.

Clamp score to `[0, 1]` and round to two decimals.

Action selection:

- If critic is disabled: `continue`.
- If score is less than or equal to `stopThreshold`: `stop`.
- If score is less than or equal to `branchThreshold`: `branch`.
- If score is less than or equal to `retryThreshold`: `retry`.
- If score is below `humanReviewThreshold` and there is any concern: `human-review`.
- Otherwise: `continue`.

### UI Integration

Modify `agent-browser/src/features/process/ProcessPanel.tsx`:

- Accept optional `criticSettings?: TrajectoryCriticSettings`.
- Compute `evaluateTrajectory({ entries, message, settings: criticSettings })`.
- Render a compact verdict band below the header with:
  - action label
  - score percentage
  - summary
  - first three concern/confidence reasons

Modify `agent-browser/src/App.tsx`:

- Add a stored state entry for trajectory critic settings.
- Pass the settings into `ProcessPanel`.
- Add a settings section with:
  - enable toggle
  - four numeric threshold inputs with `min=0`, `max=1`, `step=0.01`
  - concise current action mapping copy

Modify `agent-browser/src/App.css`:

- Add compact `.trajectory-critic-*` classes matching the process panel palette.
- Keep controls dense and stable; no cards inside cards.

### Persistence

Modify `agent-browser/src/services/sessionState.ts`:

- Add `trajectoryCriticSettings: 'agent-browser.trajectory-critic-settings'` to `STORAGE_KEYS`.

The validator stays in `trajectoryCritic.ts` to avoid bloating the shared storage utility.

## One-Shot LLM Prompt

```text
Implement Linear TK-45 in agent-browser.

Use TDD. First add failing Vitest coverage for a deterministic trajectory critic service, session settings validation, and process-panel UI rendering. Then implement the minimal production code.

Create agent-browser/src/services/trajectoryCritic.ts with DEFAULT_TRAJECTORY_CRITIC_SETTINGS, isTrajectoryCriticSettings, normalizeTrajectoryCriticSettings, and evaluateTrajectory. The evaluator accepts ProcessEntry[], an optional ChatMessage, and settings. It returns enabled, score, action, summary, and structured reasons. Score starts at 0.72, adds confidence for completion/result/commit, useful tool result, approving vote, and healthy branching; subtracts concerns for failed entries, aborts, rejected votes, tool errors, stale active entries on finished messages, and assistant message errors. Clamp and round score.

Persist settings through STORAGE_KEYS.trajectoryCriticSettings in sessionState.ts. Wire App.tsx to load settings from localStorage, pass them to ProcessPanel, and expose SettingsPanel controls for enabled, retryThreshold, branchThreshold, stopThreshold, and humanReviewThreshold. Keep validation strict: booleans only, thresholds finite 0..1, and ordered stop <= branch <= retry <= humanReview.

Update ProcessPanel to render a compact critic verdict band near the process header. It should show the recommended action, score percentage, summary, and up to three reasons. Add CSS in App.css using existing process-panel visual language.

Run focused tests, lint, and npm.cmd run verify:agent-browser. Run npm.cmd run visual:agent-browser and preserve the screenshot for PR evidence.
```

## File Structure

- Create: `agent-browser/src/services/trajectoryCritic.ts`
- Create: `agent-browser/src/services/trajectoryCritic.test.ts`
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/services/sessionState.test.ts`
- Modify: `agent-browser/src/features/process/ProcessPanel.tsx`
- Modify: `agent-browser/src/features/process/ProcessPanel.test.tsx`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`

## TDD Task Plan

### Task 1: Critic Service

**Files:**
- Create: `agent-browser/src/services/trajectoryCritic.test.ts`
- Create: `agent-browser/src/services/trajectoryCritic.ts`

- [ ] **Step 1: Write failing service tests**

```ts
import { describe, expect, it } from 'vitest';
import type { ProcessEntry } from './processLog';
import {
  DEFAULT_TRAJECTORY_CRITIC_SETTINGS,
  evaluateTrajectory,
  isTrajectoryCriticSettings,
  normalizeTrajectoryCriticSettings,
} from './trajectoryCritic';

const entry = (overrides: Partial<ProcessEntry>): ProcessEntry => ({
  id: overrides.id ?? 'entry-1',
  position: overrides.position ?? 0,
  ts: overrides.ts ?? 1,
  kind: overrides.kind ?? 'reasoning',
  actor: overrides.actor ?? 'agent',
  summary: overrides.summary ?? 'Thinking',
  status: overrides.status ?? 'done',
  ...overrides,
});

describe('trajectoryCritic', () => {
  it('continues high-confidence completed trajectories', () => {
    const result = evaluateTrajectory({
      entries: [
        entry({ id: 'tool', kind: 'tool-result', summary: 'Tests passed', transcript: 'ok' }),
        entry({ id: 'done', kind: 'completion', summary: 'Completion passed' }),
      ],
    });

    expect(result.action).toBe('continue');
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.reasons.some((reason) => reason.kind === 'confidence')).toBe(true);
  });

  it('recommends retry for recoverable tool errors', () => {
    const result = evaluateTrajectory({
      entries: [
        entry({ id: 'tool', kind: 'tool-result', summary: 'Command error', transcript: 'Error: test failed' }),
      ],
      settings: DEFAULT_TRAJECTORY_CRITIC_SETTINGS,
    });

    expect(result.action).toBe('retry');
    expect(result.reasons.map((reason) => reason.code)).toContain('tool-error');
  });

  it('recommends branch or stop for severe trajectory failures', () => {
    const branch = evaluateTrajectory({
      entries: [
        entry({ id: 'vote', kind: 'vote', summary: 'Voter rejected', transcript: 'incorrect', payload: { approve: false } }),
        entry({ id: 'tool', kind: 'tool-result', summary: 'Command error', transcript: 'Error: failed' }),
      ],
    });
    const stop = evaluateTrajectory({
      entries: [
        entry({ id: 'fail', kind: 'tool-result', summary: 'Failed', status: 'failed', transcript: 'Error: failed' }),
        entry({ id: 'abort', kind: 'abort', summary: 'Abort', transcript: 'unsafe' }),
      ],
      message: { id: 'm1', role: 'assistant', content: '', isError: true },
    });

    expect(branch.action).toBe('branch');
    expect(stop.action).toBe('stop');
  });

  it('normalizes invalid settings to defaults', () => {
    expect(isTrajectoryCriticSettings(DEFAULT_TRAJECTORY_CRITIC_SETTINGS)).toBe(true);
    expect(isTrajectoryCriticSettings({ enabled: true, stopThreshold: 0.6, branchThreshold: 0.4, retryThreshold: 0.5, humanReviewThreshold: 0.7 })).toBe(false);
    expect(normalizeTrajectoryCriticSettings({ enabled: false, stopThreshold: 0.1, branchThreshold: 0.2, retryThreshold: 0.3, humanReviewThreshold: 0.4 }).enabled).toBe(false);
    expect(normalizeTrajectoryCriticSettings({ enabled: 'yes' }).enabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run red test**

Run: `npm.cmd --workspace agent-browser run test -- src/services/trajectoryCritic.test.ts`

Expected: FAIL because `./trajectoryCritic` does not exist.

- [ ] **Step 3: Implement the service**

Implement the types, settings validator, normalization helper, scoring rules, score clamp/rounding, reason aggregation, and action selection exactly from the spec above.

- [ ] **Step 4: Run green test**

Run: `npm.cmd --workspace agent-browser run test -- src/services/trajectoryCritic.test.ts`

Expected: PASS.

### Task 2: Settings Persistence

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/services/sessionState.test.ts`

- [ ] **Step 1: Write failing storage key test**

Add an expectation in the existing `sessionState` test suite:

```ts
expect(STORAGE_KEYS.trajectoryCriticSettings).toBe('agent-browser.trajectory-critic-settings');
```

- [ ] **Step 2: Run red test**

Run: `npm.cmd --workspace agent-browser run test -- src/services/sessionState.test.ts`

Expected: FAIL because `trajectoryCriticSettings` is missing.

- [ ] **Step 3: Add storage key**

Add `trajectoryCriticSettings: 'agent-browser.trajectory-critic-settings'` under durable localStorage keys in `sessionState.ts`.

- [ ] **Step 4: Run green test**

Run: `npm.cmd --workspace agent-browser run test -- src/services/sessionState.test.ts`

Expected: PASS.

### Task 3: Process Panel Verdict UI

**Files:**
- Modify: `agent-browser/src/features/process/ProcessPanel.test.tsx`
- Modify: `agent-browser/src/features/process/ProcessPanel.tsx`
- Modify: `agent-browser/src/App.css`

- [ ] **Step 1: Write failing UI test**

Add a test that renders `ProcessPanel` with a failed tool result and asserts that "Trajectory critic", "Retry", and the tool error reason are visible.

- [ ] **Step 2: Run red test**

Run: `npm.cmd --workspace agent-browser run test -- src/features/process/ProcessPanel.test.tsx`

Expected: FAIL because the verdict band is not rendered.

- [ ] **Step 3: Render critic verdict**

Import `evaluateTrajectory`; add `criticSettings?: TrajectoryCriticSettings` prop; render a compact verdict section between the header and graph body.

- [ ] **Step 4: Run green test**

Run: `npm.cmd --workspace agent-browser run test -- src/features/process/ProcessPanel.test.tsx`

Expected: PASS.

### Task 4: App Wiring and Settings Controls

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`

- [ ] **Step 1: Write failing integration test where practical**

If existing App tests can mount settings without large fixture churn, assert the Settings panel exposes "Trajectory critic" and threshold inputs. If the existing App harness is too expensive, keep coverage through the pure validator and ProcessPanel UI tests and validate App wiring through TypeScript.

- [ ] **Step 2: Wire stored settings**

Use:

```ts
const [trajectoryCriticSettings, setTrajectoryCriticSettings] = useStoredState(
  localStorageBackend,
  STORAGE_KEYS.trajectoryCriticSettings,
  isTrajectoryCriticSettings,
  DEFAULT_TRAJECTORY_CRITIC_SETTINGS,
);
```

Pass `trajectoryCriticSettings` to every `ProcessPanel` render.

- [ ] **Step 3: Add settings controls**

Create a compact `TrajectoryCriticSettingsPanel` helper in `App.tsx` near other settings helpers. Use a checkbox for enablement and numeric inputs for thresholds. Normalize on every change before persisting.

- [ ] **Step 4: Typecheck**

Run: `npm.cmd --workspace agent-browser run lint`

Expected: PASS.

### Task 5: Full Verification and PR

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm.cmd --workspace agent-browser run test -- src/services/trajectoryCritic.test.ts src/services/sessionState.test.ts src/features/process/ProcessPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full gate**

Run: `npm.cmd run verify:agent-browser`

Expected: PASS. If the Windows sandbox blocks `esbuild` or Vite process spawn with `spawn EPERM`, record the exact blocker and the narrower gates that passed.

- [ ] **Step 3: Run visual smoke**

Run: `npm.cmd run visual:agent-browser`

Expected: screenshot at `output/playwright/agent-browser-visual-smoke.png`. If blocked by `spawn EPERM`, do not claim visual review completed.

- [ ] **Step 4: Publish**

Use `scripts/codex-git.ps1` and `scripts/codex-gh.ps1` to create branch `codex/tk-45-trajectory-critics`, commit, push, open a PR, add `codex` and `codex-automation` labels, include the screenshot if produced, and link PR to Linear TK-45.

## Self-Review

Spec coverage:

- Scoring: Task 1.
- Settings validation and persistence: Tasks 1 and 2.
- Process panel visibility: Task 3.
- User-configurable thresholds: Task 4.
- Verification, visual review, PR, and Linear completion: Task 5.

Placeholder scan: no TBD, TODO, or "implement later" placeholders remain.

Type consistency: `TrajectoryCriticSettings`, `TrajectoryCriticResult`, and `TrajectoryCriticAction` names are consistent across service, panel, and app wiring.
