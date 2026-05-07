# Durable Agent Canvases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build durable Agent Browser canvases for agent-authored dashboards, diagrams, checklists, and review panels.

**Architecture:** Represent canvases as a typed layer over existing `AgentArtifact` records so persistence, artifact IDs, file bundles, downloads, and version history stay in one storage model. Add revision-checked canvas updates, prompt context that teaches agents how to safely update canvases, and a first-class sidebar panel for review and opening.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Playwright visual smoke, existing `agent-browser` artifact and session-state services.

---

## Feature Implementation Plan

TK-38 asks for durable agent canvases that live beside transcript, terminal, browser, and diff views. The smallest complete implementation is a first-class canvas surface backed by the existing artifact store, not a new storage subsystem.

This implementation creates:

- Typed canvas kinds: dashboard, diagram, checklist, review panel.
- Explicit canvas IDs using existing artifact IDs.
- Revision metadata from artifact version history.
- Safe follow-up updates with expected-revision checks.
- A Canvases sidebar panel with starter canvas creation, summary cards, revision/file metadata, and open/attach actions.
- Agent prompt context explaining mounted canvas IDs, revisions, files, and update safety.
- Smoke and visual assertions for the new panel.

## Architecture-Aligned Technical Spec

### Data Model

Create `agent-browser/src/services/agentCanvases.ts`.

Canvases are `AgentArtifact` objects whose `kind` is `agent-canvas:<canvasKind>`. This keeps storage in `STORAGE_KEYS.artifactsByWorkspace`, avoids a second persistence tree, and makes canvases available in `//artifacts/<id>/<file>`.

Key APIs:

```ts
export type AgentCanvasKind = 'dashboard' | 'diagram' | 'checklist' | 'review-panel';

export function createAgentCanvasArtifact(input, options): AgentArtifact;
export function updateAgentCanvasArtifactSafely(artifact, patch, options): AgentArtifact;
export function listAgentCanvasSummaries(artifacts): AgentCanvasSummary[];
export function buildAgentCanvasPromptContext(artifacts): string;
export function createStarterAgentCanvases(input): AgentArtifact[];
```

Revision number is `artifact.versions.length + 1`. Safe updates require `expectedRevision` to match that current number before `updateArtifactFiles` is called.

### UI

Modify `agent-browser/src/App.tsx`.

Add `canvases` to `SidebarPanel`, `PRIMARY_NAV`, `PANEL_SHORTCUT_ORDER`, `SIDEBAR_PANEL_META`, and `VALID_SIDEBAR_PANELS`. Add `AgentCanvasesPanel` after `RepoWikiPanel`, using existing `SidebarSection`, `Icon`, `badge`, and `repo-wiki-card` visual language.

The panel accepts:

```ts
{
  workspaceName: string;
  summaries: AgentCanvasSummary[];
  onCreateStarterCanvases: () => void;
  onOpenCanvas: (artifactId: string, filePath?: string | null) => void;
  onAttachCanvas: (artifactId: string) => void;
}
```

### Agent Runtime Context

When rendering `ChatPanel`, append `buildAgentCanvasPromptContext(activeArtifacts)` beside the existing artifact prompt context. Agents should see canvas IDs, kinds, current revisions, file paths, and the requirement to use the current revision when making follow-up updates.

### Visual Design

Reuse dark operational panel styling from wiki/history. Avoid marketing or decorative cards. The panel should be dense, accessible, mobile-safe, and action-oriented:

- Header with active workspace and canvas count.
- Starter action button.
- Four compact kind metrics.
- Canvas cards with kind, revision, file count, updated time, and open/attach icon buttons.
- Empty state that still exposes the starter action.

## One-Shot LLM Prompt

You are implementing Linear TK-38 in `agent-browser`.

Build durable agent canvases as a typed layer over existing Agent Browser artifacts. Do not create a parallel persistence store. Add `agent-browser/src/services/agentCanvases.ts` with typed canvas kinds, `agent-canvas:<kind>` artifact kinds, starter canvas creation for dashboard/diagram/checklist/review-panel canvases, summary extraction, prompt context generation, and revision-checked safe update behavior. Add full Vitest coverage for creation, summary ordering, prompt context, validation, and revision mismatch rejection.

Wire the feature through `agent-browser/src/App.tsx`: add a `Canvases` primary sidebar item, render an accessible `AgentCanvasesPanel`, create starter canvases into `artifactsByWorkspace`, open selected canvases with the existing artifact viewer, attach canvases to a session through the existing artifact context, and append canvas prompt context to chat runtime instructions. Keep UI styling in `agent-browser/src/App.css`, following existing repo wiki/history panel patterns and mobile-safe dense operational UI.

Update `agent-browser/src/App.smoke.test.tsx` and `agent-browser/scripts/visual-smoke.mjs` to prove the Canvases panel renders and starter seeded canvases are visible. Run focused tests first, then `npm.cmd run verify:agent-browser`; save visual smoke evidence for the PR.

## TDD Task Plan

### Task 1: Canvas Service

**Files:**
- Create: `agent-browser/src/services/agentCanvases.ts`
- Create: `agent-browser/src/services/agentCanvases.test.ts`

- [ ] **Step 1: Write failing service tests**

Create tests for starter canvas creation, summary extraction, prompt context, and stale revision rejection.

- [ ] **Step 2: Run service tests to verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/services/agentCanvases.test.ts`

Expected: fail because `agentCanvases.ts` does not exist.

- [ ] **Step 3: Implement service**

Implement the typed artifact wrapper and revision-safe update helpers.

- [ ] **Step 4: Run service tests to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/services/agentCanvases.test.ts`

Expected: all canvas service tests pass.

### Task 2: Sidebar UI

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/src/App.smoke.test.tsx`

- [ ] **Step 1: Write failing smoke test**

Add a test that opens the Canvases panel, sees the empty/starter state, creates starter canvases, and sees dashboard/checklist/revision metadata.

- [ ] **Step 2: Run smoke test to verify RED**

Run: `npm.cmd --workspace agent-browser run test:app -- App.smoke.test.tsx -t "renders durable agent canvases"`

Expected: fail because the Canvases navigation item does not exist.

- [ ] **Step 3: Implement UI**

Add navigation, panel rendering, starter creation, open/attach actions, and CSS.

- [ ] **Step 4: Run smoke test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test:app -- App.smoke.test.tsx -t "renders durable agent canvases"`

Expected: test passes.

### Task 3: Agent Prompt Context and Visual Smoke

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/scripts/visual-smoke.mjs`

- [ ] **Step 1: Write failing visual/script assertion**

Seed canvas artifacts in visual smoke localStorage and assert the Canvases panel, `Launch dashboard`, and `rev 2` are visible.

- [ ] **Step 2: Run script checks to verify RED**

Run: `npm.cmd --workspace agent-browser run test:scripts`

Expected: fail until the visual-smoke expectations are wired to the new UI.

- [ ] **Step 3: Implement prompt context wiring**

Append `buildAgentCanvasPromptContext(activeArtifacts)` to the artifact prompt context for `ChatPanel`.

- [ ] **Step 4: Run script checks to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test:scripts`

Expected: script tests pass.

### Task 4: Full Verification and PR

**Files:**
- All changed files

- [ ] **Step 1: Run source hygiene**

Run: `npm.cmd run check:generated-files`

- [ ] **Step 2: Run full Agent Browser verifier**

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`

- [ ] **Step 3: Save visual evidence**

Copy `output/playwright/agent-browser-visual-smoke.png` to `docs/superpowers/plans/2026-05-07-durable-agent-canvases-visual-smoke.png` after a passing visual run.

- [ ] **Step 4: Publish**

Create branch `codex/tk-38-durable-agent-canvases`, commit, push, open PR, label `codex` and `codex-automation`, update Linear, wait for green checks, then move TK-38 to Done.

## Self-Review

Spec coverage: the plan covers durable artifacts, explicit IDs, revision history, safe updates, canvas types, app side-panel placement, prompt context, tests, visual validation, PR flow, and Linear updates.

Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.

Type consistency: `AgentCanvasKind`, `AgentCanvasSummary`, `AgentArtifact`, and `expectedRevision` are used consistently across service, UI, and tests.
