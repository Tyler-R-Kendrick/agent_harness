# Workspace Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let browser agents create persistent, governed workspace surfaces from artifacts so dashboards, widgets, guided pages, browser panes, and review panels become first-class app outputs.

**Architecture:** Reuse the existing `AgentArtifact` store and `HarnessDashboardPanel` instead of adding a second persistence layer. Add a small `workspaceSurfaces` service that converts artifact metadata into governed surface records, tracks ownership/permissions/revision history, and emits prompt context for follow-up agent updates; render those records inside the existing dashboard.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, existing `agent-browser` localStorage-backed session state, Playwright visual smoke.

---

## Feature Implementation Plan

TK-35 asks for a mutable workspace-surface system where agents can persist dashboards, widgets, guided flows, browser panes, and review panels inside `agent-browser`. The implementation should treat generated UI as governed workspace state, not as unmanaged chat text. The smallest useful implementation is:

- A typed surface model linked to artifact ids.
- Deterministic creation/update/rollback helpers with permission and owner metadata.
- Durable per-workspace storage under `agent-browser.workspace-surfaces-by-workspace`.
- Prompt context that tells agents how to create/update/rollback surfaces safely.
- Dashboard UI that lists installed surfaces with owner, permissions, revision, rollback status, and artifact links.
- Smoke/visual coverage that proves the surface list renders and remains responsive.

## Architecture-Aligned Technical Spec

### Existing Architecture

- `agent-browser/src/services/artifacts.ts` already stores durable agent outputs with versions and files.
- Agent Canvas is now the plugin media-renderer contract, not a workspace surface or sidebar. Renderer declarations live on extension manifests and are resolved for artifact media types at open time.
- `agent-browser/src/services/sessionState.ts` centralizes localStorage keys and validators.
- `agent-browser/src/features/harness-ui/HarnessDashboardPanel.tsx` renders the persistent dashboard canvas.
- `agent-browser/src/App.tsx` owns the workspace stores, artifact stores, and dashboard props.

### New Model

Create `agent-browser/src/services/workspaceSurfaces.ts`.

Surface types:

- `dashboard`
- `widget`
- `guided-flow`
- `browser-pane`
- `review-panel`

Permission fields:

- `canRead`
- `canEdit`
- `canRollback`
- `canShare`

Each surface stores:

- Stable `id`
- `workspaceId`
- `artifactId`
- `artifactFilePath`
- Human title/description
- Type and render target
- `createdByAgent`
- `ownerSessionId`
- `permissions`
- `revision`
- `createdAt`
- `updatedAt`
- `versions`
- `status`: `active` or `rolled-back`

### Behavior

- Creating a surface normalizes unsafe ids and fills conservative default permissions.
- Updating a surface requires the expected revision and writes the old state into `versions`.
- Rolling back a surface requires `canRollback`, restores a prior version, increments the revision, and marks status active.
- Prompt context lists active surfaces and required expected revision values.
- UI uses the existing dashboard visual language and does not execute arbitrary artifact HTML.

## One-Shot LLM Prompt

Implement TK-35 in `agent-browser` with strict TDD. Add a `workspaceSurfaces` service that links agent-generated artifacts to persistent workspace surfaces with owner, permission, revision, and rollback metadata. Persist records under `STORAGE_KEYS.workspaceSurfacesByWorkspace` with validators in `sessionState.ts`. Render active surfaces in `HarnessDashboardPanel` as governed surface cards showing type, owner agent, permission summary, revision, rollback availability, and artifact file path. Wire `App.tsx` so the active workspace passes surface summaries to the dashboard and prompt context includes the active surfaces. Add service tests, App smoke coverage, and visual-smoke assertions. Reuse existing artifacts and harness dashboard patterns; do not execute untrusted artifact scripts or create a parallel UI framework.

## TDD Task List

### Task 1: Surface Service

**Files:**
- Create: `agent-browser/src/services/workspaceSurfaces.ts`
- Test: `agent-browser/src/services/workspaceSurfaces.test.ts`

- [ ] Write failing tests for creation defaults, id normalization, prompt context, revision-checked update, rollback, and validator rejection.
- [ ] Run `npm.cmd --workspace agent-browser exec vitest run src/services/workspaceSurfaces.test.ts` and confirm the tests fail because the service does not exist.
- [ ] Implement minimal pure functions and types.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Durable Session State

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Test: `agent-browser/src/services/sessionState.test.ts`

- [ ] Write a failing test that `STORAGE_KEYS.workspaceSurfacesByWorkspace` exists and validates a per-workspace surface record map.
- [ ] Run the focused session-state test and confirm failure.
- [ ] Export `isWorkspaceSurfacesByWorkspace` from the service and wire the key/validator.
- [ ] Re-run the focused tests.

### Task 3: Dashboard UI

**Files:**
- Modify: `agent-browser/src/features/harness-ui/HarnessDashboardPanel.tsx`
- Modify: `agent-browser/src/App.css`
- Test: `agent-browser/src/App.smoke.test.tsx`

- [ ] Write a failing smoke test that seeds one workspace surface in localStorage and expects a dashboard region named `Agent-authored workspace surfaces`.
- [ ] Run the focused smoke test and confirm failure.
- [ ] Add `surfaces` props to `HarnessDashboardPanel` and render responsive governed surface cards.
- [ ] Re-run the focused smoke test.

### Task 4: App Wiring

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/services/sessionState.ts`

- [ ] Hydrate `workspaceSurfacesByWorkspace` with `useStoredState`.
- [ ] Derive active surface summaries from active workspace artifacts.
- [ ] Pass summaries to `HarnessDashboardPanel`.
- [ ] Include `buildWorkspaceSurfacePromptContext` in the chat prompt context near artifact/canvas context.

### Task 5: Visual and Repo Verification

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`

- [ ] Add a seeded localStorage surface fixture in visual smoke.
- [ ] Assert the governed surface list is visible at desktop width.
- [ ] Capture `docs/superpowers/plans/2026-05-08-workspace-surfaces-visual-smoke.png`.
- [ ] Run focused tests, `npm.cmd --workspace agent-browser run lint`, and `npm.cmd run verify:agent-browser`.
- [ ] Publish a PR with the screenshot path in the body, link it to TK-35, and move TK-35 to Done only after verification and PR publication succeed.

## Self-Review

- Spec coverage: artifact linking, ownership, permissions, rollback, persistence, prompt context, dashboard rendering, and visual proof are covered.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: `WorkspaceSurface`, `WorkspaceSurfaceSummary`, and `workspaceSurfacesByWorkspace` are the canonical names across tasks.
