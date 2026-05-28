# Durable Symphony Task Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Symphony project board persist one multi-agent task board per workspace.

**Architecture:** Keep `SymphonyWorkspaceApp` as the only task-board UI. Move durable ownership from one global `MultitaskSubagentState` to a workspace-keyed localStorage record, while retaining the old key as the active-workspace compatibility mirror.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, existing `useStoredState` persistence.

---

### Task 1: Storage Contract

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/services/sessionState.test.ts`
- Modify: `agent-browser/src/services/multitaskSubagents.ts`
- Modify: `agent-browser/src/services/multitaskSubagents.test.ts`

- [ ] **Step 1: Write the failing tests**

Add expectations for `STORAGE_KEYS.multitaskSubagentStateByWorkspace` and `isMultitaskSubagentStateRecord`.

- [ ] **Step 2: Run the focused tests**

Run: `npm.cmd --workspace agent-browser run test -- src/services/sessionState.test.ts src/services/multitaskSubagents.test.ts`

Expected: FAIL because the key and validator are missing.

- [ ] **Step 3: Implement the contract**

Add `multitaskSubagentStateByWorkspace: 'agent-browser.multitask-subagent-state-by-workspace'` and export a record validator that delegates each value to `isMultitaskSubagentState`.

- [ ] **Step 4: Re-run the focused tests**

Run: `npm.cmd --workspace agent-browser run test -- src/services/sessionState.test.ts src/services/multitaskSubagents.test.ts`

Expected: PASS.

### Task 2: App Persistence

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.smoke.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

Seed a `ws-research` Symphony board in the workspace-keyed store, activate `ws-build`, start a Symphony task, and assert both `ws-research` and `ws-build` remain in durable storage.

- [ ] **Step 2: Run the smoke test**

Run: `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx -t "keeps Symphony boards durable per workspace"`

Expected: FAIL because the app only writes the legacy single-state key.

- [ ] **Step 3: Implement active-workspace persistence**

Hydrate `activeMultitaskSubagentState` from `multitaskSubagentStateByWorkspace[activeWorkspaceId]`, fall back to matching legacy state, and route all Symphony mutations through a helper that updates the workspace-keyed store and mirrors the active workspace to the legacy key.

- [ ] **Step 4: Re-run the smoke test**

Run: `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx -t "keeps Symphony boards durable per workspace"`

Expected: PASS.

### Task 3: Verification

**Files:**
- Validate changed `agent-browser/src/**`

- [ ] **Step 1: Run focused coverage**

Run: `npm.cmd --workspace agent-browser run test:coverage -- src/services/multitaskSubagents.ts src/services/sessionState.ts`

Expected: PASS with 100% thresholds for changed service files.

- [ ] **Step 2: Run visual validation**

Run: `npm.cmd run visual:agent-browser`

Expected: PASS and update `output/playwright/agent-browser-visual-smoke.png`.

- [ ] **Step 3: Run full gate**

Run: `npm.cmd run verify:agent-browser`

Expected: PASS, or preserve the exact blocker if the Windows environment prevents completion.
