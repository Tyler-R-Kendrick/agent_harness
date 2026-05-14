# Local-First WorkGraph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable local-first work management framework and weave it into Symphony so agent subtasks, isolated branches, review gates, and merge approval are modeled as durable work instead of Linear-shaped mock UI.

**Architecture:** Add `lib/workgraph` as the browser-native source of truth for workspace/team/issue/project/cycle/view state. The library uses command validation, immutable events, projected state, IndexedDB-compatible repositories, local search, import/export, React subscriptions, and durable task integration. Symphony consumes the library through the runtime plugin and app services; the render area remains the main task management surface while the side panel shows only current activity.

**Tech Stack:** TypeScript, Dexie, Zod, React `useSyncExternalStore`, Vitest, `@agent-harness/browser-durable-tasks`, existing Agent Browser Symphony runtime.

---

### Task 1: WorkGraph Contract And Package Skeleton

**Files:**
- Create: `lib/workgraph/package.json`
- Create: `lib/workgraph/tsconfig.json`
- Create: `lib/workgraph/vitest.config.ts`
- Create: `lib/workgraph/src/__tests__/workgraph-command-bus.test.ts`
- Create: `lib/workgraph/src/__tests__/workgraph-react-store.test.ts`

- [x] **Step 1: Write failing tests**

Write tests that create a workspace, team workflow, project, cycle, label, issue, comment, saved view, search index task, agent proposal, export/import payload, and React external store subscription.

- [x] **Step 2: Verify red**

Run: `npm.cmd --workspace @agent-harness/workgraph run test`

Expected: FAIL because `createWorkGraph`, `createInMemoryWorkGraphRepository`, and related APIs do not exist.

- [x] **Step 3: Implement package config**

Create the workspace package with strict TypeScript and 100% Vitest coverage thresholds.

- [x] **Step 4: Verify green**

Run: `npm.cmd --workspace @agent-harness/workgraph run test:coverage`

Expected: PASS with 100% coverage.

### Task 2: Event-Sourced WorkGraph Core

**Files:**
- Create: `lib/workgraph/src/core/*.ts`
- Create: `lib/workgraph/src/commands/*.ts`
- Create: `lib/workgraph/src/events/*.ts`
- Create: `lib/workgraph/src/store/*.ts`
- Create: `lib/workgraph/src/issues/*.ts`
- Create: `lib/workgraph/src/projects/*.ts`
- Create: `lib/workgraph/src/cycles/*.ts`
- Create: `lib/workgraph/src/comments/*.ts`
- Create: `lib/workgraph/src/labels/*.ts`
- Create: `lib/workgraph/src/views/*.ts`
- Modify: `lib/workgraph/src/index.ts`

- [x] **Step 1: Implement immutable event model**

Commands append events only; projections are rebuilt from events. Application code cannot mutate projections directly.

- [x] **Step 2: Implement command bus and validators**

Use Zod to validate command payloads. Reject invalid commands with `WorkGraphCommandError`.

- [x] **Step 3: Implement projections and selectors**

Expose normalized projected state, issue sorting, local query helpers, and saved view filtering.

- [x] **Step 4: Run WorkGraph tests**

Run: `npm.cmd --workspace @agent-harness/workgraph run test:coverage`

Expected: PASS.

### Task 3: Durable Tasks, Search, Agent Proposals, Import/Export, React

**Files:**
- Create: `lib/workgraph/src/search/*.ts`
- Create: `lib/workgraph/src/automations/*.ts`
- Create: `lib/workgraph/src/agent/*.ts`
- Create: `lib/workgraph/src/sync/*.ts`
- Create: `lib/workgraph/src/react/*.ts`
- Create: `lib/workgraph/src/import-export/*.ts`
- Create: `lib/workgraph/src/testing/*.ts`

- [x] **Step 1: Implement local search**

Build an issue search index from projected state and return ranked local results.

- [x] **Step 2: Implement durable automation integration**

Use `DurableTaskRuntime.enqueue` for search indexing, import/export, sync, and Symphony branch automation intents.

- [x] **Step 3: Implement agent-safe proposal API**

Agents can propose issues and branches through typed commands; proposals preserve actor identity and approval state.

- [x] **Step 4: Implement React subscriptions**

Use `useSyncExternalStore` and a provider-backed store so UI code can subscribe to projected WorkGraph state.

- [x] **Step 5: Run WorkGraph tests**

Run: `npm.cmd --workspace @agent-harness/workgraph run test:coverage`

Expected: PASS.

### Task 4: Symphony Integration And UI Cleanup

**Files:**
- Removed: legacy `ext/runtime/symphony` board/plugin package; Symphony board work now lives in the first-class Symphony UI.
- Modify: `agent-browser/src/services/multitaskSubagents.ts`
- Modify: `agent-browser/src/features/symphony/SymphonyOrchestrationPanel.tsx`
- Modify: `agent-browser/src/features/symphony/SymphonyOrchestrationPanel.test.tsx`
- Modify: `agent-browser/src/services/multitaskSubagents.test.ts`
- Modify: `agent-browser/scripts/visual-smoke.mjs`

- [x] **Step 1: Export WorkGraph through Symphony**

The Symphony runtime plugin re-exports WorkGraph primitives so orchestration code can create durable workspace/team/project/issue records without Linear.

- [x] **Step 2: Map branch subtasks to WorkGraph commands**

Each generated Symphony branch becomes a WorkGraph issue with workflow status, branch metadata, validation criteria, and review approval state.

- [x] **Step 3: Collapse close/delete into one task action**

Remove the extra cancel button from the workspace table. The single destructive row action is “Close task and dispose workspace”, represented by the dispose lifecycle action.

- [x] **Step 4: Update UI and smoke tests**

Assert that users can start, stop, retry, approve, request changes, and close/dispose workspaces from the render area without duplicate controls.

### Task 5: Verification

**Files:**
- Modify only as needed by failing verification.

- [x] **Step 1: Run package tests**

Run: `npm.cmd --workspace @agent-harness/workgraph run test:coverage`

- [x] **Step 2: Run focused Agent Browser tests**

Run: `npm.cmd --workspace agent-browser run test -- src/services/multitaskSubagents.test.ts src/features/symphony/SymphonyOrchestrationPanel.test.tsx`

- [ ] **Step 3: Run full Agent Browser verifier**

Run: `npm.cmd run verify:agent-browser`

- [ ] **Step 4: Capture output**

Use the generated `output/playwright/agent-browser-symphony-system.png` as visual proof for the PR description.
