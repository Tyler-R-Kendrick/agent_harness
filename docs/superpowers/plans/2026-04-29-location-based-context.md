# Location-Based Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let agent-browser users opt in to browser geolocation and include coarse location as user/session context for chat agents.

**Architecture:** Add a small browser-location service beside the existing browser notification service, persist its opt-in state through `sessionState`, and inject a formatted location context block into the existing `workspacePromptContext` string that every chat provider already receives. Add a compact titlebar control in `ChatPanel`, matching the notification control pattern, so location is requested only after an explicit user action.

**Tech Stack:** React, TypeScript, browser Geolocation API, localStorage via existing `useStoredState`, Vitest, Testing Library, Vite visual smoke.

---

## Feature Implementation Plan

1. Build a pure `browserLocation` service that normalizes geolocation support, request results, persisted state validation, privacy rounding, and prompt formatting.
2. Add `STORAGE_KEYS.locationContext` and hydrate/persist location settings in `ChatPanel`.
3. Add a MapPin titlebar control that requests location, toggles location context off, shows disabled/available/unavailable states, and uses existing toast feedback.
4. Include the formatted location context in `workspacePromptContext` before sending messages to Codi/GHCP/Researcher/Debugger.
5. Add tests first for service validation/formatting and App-level opt-in prompt inclusion.
6. Run targeted tests, full `npm.cmd run verify:agent-browser`, visual smoke review, then publish a draft PR with screenshot evidence.

## Technical Spec

### User behavior

- Default state is disabled. The app never calls `navigator.geolocation.getCurrentPosition` on mount.
- The user clicks the location icon in the chat titlebar to request location.
- If the browser supports geolocation and permission succeeds, the app stores:
  - `enabled: true`
  - latitude and longitude rounded to two decimals
  - accuracy rounded to the nearest meter when available
  - ISO timestamp for when the location was captured
- If the user clicks the icon again, `enabled` becomes false and no location context is injected.
- Unsupported browsers and denied/unavailable requests show warning toasts and keep context disabled.

### Privacy contract

- Prompt context uses coarse coordinates only, rounded to roughly city scale.
- The app does not reverse geocode, call a backend, or store precise raw coordinates.
- The prompt clearly says the context is browser-provided and approximate.

### Prompt contract

When enabled, the existing workspace prompt context receives an additional section:

```text
Browser location context:
- Approximate coordinates: 41.88, -87.63
- Accuracy: about 25m
- Captured: 2026-04-29T19:00:00.000Z

Use this as approximate session context when location is relevant. Do not assume it is exact.
```

When disabled or unavailable, no browser-location section is added.

### UI contract

- The control lives in the chat titlebar next to the notification toggle.
- It uses lucide `MapPin` when enabled and `MapPinOff` when disabled.
- Accessible labels are `Enable location context` and `Disable location context`.
- Tooltip/status copy is short: `Location context on`, `Location context off`, or `Location unavailable`.
- The footer context strip appends `location on` only when the context is enabled.

### One-Shot LLM Prompt

```text
You are implementing TK-34 Location-Based Context in C:\Users\conta\.codex\worktrees\1ef1\agent-harness.

Use TDD. Do not call geolocation on mount. Add opt-in browser geolocation to agent-browser and include coarse location in chat-agent session context.

Required behavior:
- Create agent-browser/src/services/browserLocation.ts with types, default state, validator, API wrapper, request helper, coordinate rounding, and prompt formatter.
- Add tests in browserLocation.test.ts before implementation.
- Persist settings under STORAGE_KEYS.locationContext using existing useStoredState.
- Add a compact chat titlebar icon control using lucide MapPin/MapPinOff.
- On enable, call navigator.geolocation.getCurrentPosition through the service, store rounded coordinates and timestamp, and show a success toast.
- On disable, keep the last captured location but set enabled false and remove it from prompts.
- Handle unsupported/denied/unavailable errors with warning toasts.
- Append formatted location context to workspacePromptContext before streamAgentChat receives it.
- Update the context strip to show location on/off concisely.
- Add App tests proving no request happens on mount, clicking enables and persists settings, and sent prompts include the approximate location context.

Verification:
- First run targeted tests and confirm the new tests fail for the expected missing behavior.
- Implement the minimal code to pass.
- Run targeted tests again.
- Run npm.cmd run verify:agent-browser from the repo root.
- Run or reuse the visual smoke screenshot from verify and include it in the PR description.
```

---

### Task 1: Browser Location Service

**Files:**
- Create: `agent-browser/src/services/browserLocation.test.ts`
- Create: `agent-browser/src/services/browserLocation.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BROWSER_LOCATION_CONTEXT,
  buildBrowserLocationPromptContext,
  createBrowserLocationApi,
  isBrowserLocationContext,
  requestBrowserLocationContext,
} from './browserLocation';

describe('browserLocation', () => {
  it('formats only enabled rounded browser location context', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 41.878113, longitude: -87.629799, accuracy: 24.6 },
        timestamp: Date.parse('2026-04-29T19:00:00.000Z'),
      } as GeolocationPosition);
    });
    const api = createBrowserLocationApi({ getCurrentPosition } as unknown as Geolocation);

    const result = await requestBrowserLocationContext(api);

    expect(result.status).toBe('granted');
    expect(result.context).toEqual({
      enabled: true,
      latitude: 41.88,
      longitude: -87.63,
      accuracyMeters: 25,
      capturedAt: '2026-04-29T19:00:00.000Z',
    });
    expect(buildBrowserLocationPromptContext(result.context)).toContain('Approximate coordinates: 41.88, -87.63');
    expect(buildBrowserLocationPromptContext(DEFAULT_BROWSER_LOCATION_CONTEXT)).toBeNull();
    expect(isBrowserLocationContext(result.context)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test -- src/services/browserLocation.test.ts`

Expected: FAIL because `browserLocation.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement the service with pure helpers and no React dependency.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd --workspace agent-browser run test -- src/services/browserLocation.test.ts`

Expected: PASS.

### Task 2: Prompt and UI Integration

**Files:**
- Modify: `agent-browser/src/App.test.tsx`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/App.css`

- [ ] **Step 1: Write failing App tests**

Add tests that prove geolocation is not requested on mount, the titlebar control requests and persists coarse location after click, and the next chat prompt includes the browser location context.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm.cmd --workspace agent-browser run test -- src/App.test.tsx -t "location context"`

Expected: FAIL because no location context control exists.

- [ ] **Step 3: Implement minimal UI and prompt wiring**

Import the service, persist location settings, add the MapPin control, append the formatted prompt section, update the context strip, and keep styling consistent with existing titlebar icon controls.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm.cmd --workspace agent-browser run test -- src/App.test.tsx -t "location context"`

Expected: PASS.

### Task 3: Full Verification and Publication

**Files:**
- Modify: Linear TK-34
- Create/modify: PR branch and draft PR

- [ ] **Step 1: Run complete gate**

Run: `npm.cmd run verify:agent-browser`

Expected: PASS across lint, coverage, build, audit, and visual smoke.

- [ ] **Step 2: Review visual output**

Inspect `output/playwright/agent-browser-visual-smoke.png` and confirm the chat shell remains aligned with the new icon.

- [ ] **Step 3: Commit, push, and open PR**

Use `scripts/codex-git.ps1` and `scripts/codex-gh.ps1`. Include the visual smoke screenshot path in the PR description and add `codex` plus `codex-automation` labels when available.

- [ ] **Step 4: Complete Linear**

Link the PR on TK-34, add verification notes, and move the issue to Done.

## Self-Review

- Spec coverage: the plan covers opt-in permission, persistence, privacy rounding, prompt injection, UI, tests, visual validation, PR, and Linear completion.
- Placeholder scan: no implementation step relies on TBD behavior.
- Type consistency: `BrowserLocationContext`, `isBrowserLocationContext`, `requestBrowserLocationContext`, and `buildBrowserLocationPromptContext` are used consistently across tests and implementation.
