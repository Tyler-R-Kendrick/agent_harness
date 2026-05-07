# Multitask Subagents And Branch Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class Agent Browser multitask mode so users can decompose one request into isolated subagent branches, compare results, and promote a chosen branch back into the foreground workflow.

**Architecture:** Keep orchestration state deterministic and browser-local in a pure service, then surface that state through the existing sidebar/session persistence seams in `App.tsx`. Reuse the existing `parallelDelegationWorkflow` and `GitWorktreePanel` concepts as inputs and status surfaces; this slice records branch/worktree intent and promotion decisions without creating real OS worktrees.

**Tech Stack:** React 18, TypeScript, Vitest, existing Agent Browser `useStoredState`, existing sidebar panels, existing visual smoke script.

---

## Feature Implementation Plan

1. Add a deterministic `multitaskSubagents` service that can create a multitask plan from a user request, assign each subagent a stable branch/worktree label, compute comparison metrics, promote a selected branch, and render prompt context.
2. Persist multitask state in `sessionState.ts` with validation so refreshes preserve the current plan and chosen foreground branch.
3. Add a `MultitaskPanel` sidebar view that shows isolated subagent branches side by side, status/progress, changed-file counts, confidence, validation notes, and a promote action.
4. Feed active multitask context into chat instructions so future turns know which branch is foregrounded and which subagents are still backgrounded.
5. Add focused unit tests, App smoke coverage, and visual smoke assertions/screenshots.

## Technical Spec

### Data Model

Create `agent-browser/src/services/multitaskSubagents.ts`.

```ts
export type MultitaskSubagentStatus = 'queued' | 'running' | 'blocked' | 'ready' | 'promoted';

export interface MultitaskSubagentBranch {
  id: string;
  title: string;
  role: string;
  branchName: string;
  worktreePath: string;
  status: MultitaskSubagentStatus;
  progress: number;
  changedFiles: string[];
  summary: string;
  validation: string[];
  confidence: number;
}

export interface MultitaskSubagentState {
  enabled: boolean;
  request: string;
  workspaceId: string;
  workspaceName: string;
  createdAt: string;
  foregroundBranchId: string | null;
  branches: MultitaskSubagentBranch[];
}
```

### Pure Service Behavior

`createMultitaskSubagentState` must:
- accept workspace id/name, request, optional existing task hints, optional `now`
- create 2-4 branch records with deterministic IDs
- sanitize branch names into `agent/<workspace>/<slug>-<n>`
- mark the first branch `running` and others `queued` by default
- include validation notes and changed-file arrays for comparison

`summarizeMultitaskSubagents` must return total, running, ready, blocked, changed file total, and promoted branch.

`promoteMultitaskBranch` must:
- set the selected branch as `promoted`
- set all other non-blocked branches to `ready`
- set `foregroundBranchId`
- preserve branch order and unchanged details

`buildMultitaskPromptContext` must return an empty string when disabled or empty, otherwise include branch isolation, foreground branch, branch names, worktree paths, status, and validation notes.

### UI Behavior

Modify `agent-browser/src/App.tsx`.

- Extend `SidebarPanel` with `multitask`.
- Add `GitBranchPlus` or `Network` icon from `lucide-react` and register it in `icons`.
- Add primary nav item `['multitask', 'gitBranchPlus', 'Multitask']`.
- Add stored local state with `STORAGE_KEYS.multitaskSubagentState`.
- Add `MultitaskPanel` near existing sidebar panels.
- In `handleSend`, when a request contains parallel/subagent cues and the state is empty, create a multitask state from the current prompt.
- Add `buildMultitaskPromptContext(activeMultitaskSubagentState)` to `workspacePromptContext`.
- Pass panel props from `renderSidebarContent`.

### TDD Task Plan

### Task 1: Multitask Service

**Files:**
- Create: `agent-browser/src/services/multitaskSubagents.ts`
- Create: `agent-browser/src/services/multitaskSubagents.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
it('creates deterministic isolated subagent branches from a larger request', () => {
  const state = createMultitaskSubagentState({
    workspaceId: 'ws-research',
    workspaceName: 'Research',
    request: 'parallelize the frontend, tests, and documentation work',
    now: new Date('2026-05-07T10:00:00.000Z'),
  });
  expect(state.branches.map((branch) => branch.branchName)).toEqual([
    'agent/research/frontend-1',
    'agent/research/tests-2',
    'agent/research/documentation-3',
  ]);
});
```

- [ ] **Step 2: Run red test**

Run: `npm.cmd --workspace agent-browser run test -- src/services/multitaskSubagents.test.ts`

Expected: FAIL because `multitaskSubagents.ts` does not exist.

- [ ] **Step 3: Implement minimal service**

Add the exported types and pure functions named above.

- [ ] **Step 4: Run green test**

Run: `npm.cmd --workspace agent-browser run test -- src/services/multitaskSubagents.test.ts`

Expected: PASS.

### Task 2: Session Persistence

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/services/sessionState.test.ts`

- [ ] **Step 1: Write failing persistence test**

```ts
expect(STORAGE_KEYS).toMatchObject({
  multitaskSubagentState: expect.any(String),
});
expect(STORAGE_KEYS.multitaskSubagentState).toBe('agent-browser.multitask-subagent-state');
```

- [ ] **Step 2: Run red test**

Run: `npm.cmd --workspace agent-browser run test -- src/services/sessionState.test.ts`

Expected: FAIL because the key is missing.

- [ ] **Step 3: Add key and validator export**

Import `isMultitaskSubagentState` and export the storage key.

- [ ] **Step 4: Run green test**

Run: `npm.cmd --workspace agent-browser run test -- src/services/sessionState.test.ts`

Expected: PASS.

### Task 3: Sidebar UI

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/src/App.smoke.test.tsx`

- [ ] **Step 1: Write failing smoke test**

```ts
fireEvent.click(screen.getByLabelText('Multitask'));
expect(screen.getByRole('region', { name: 'Multitask subagents' })).toBeInTheDocument();
expect(screen.getByText('Branch isolation')).toBeInTheDocument();
expect(screen.getByRole('button', { name: /Promote/ })).toBeInTheDocument();
```

- [ ] **Step 2: Run red smoke test**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx`

Expected: FAIL because the panel does not exist.

- [ ] **Step 3: Implement panel and styles**

Add accessible sidebar controls, comparison cards, branch chips, and promotion action.

- [ ] **Step 4: Run green smoke test**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx`

Expected: PASS.

### Task 4: Visual Smoke And Verification

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`

- [ ] **Step 1: Add visual assertions**

Assert the Multitask panel shows `Branch isolation`, at least two branch names, and a promote button. Save a screenshot to `docs/superpowers/plans/2026-05-07-multitask-subagents-branch-isolation-visual-smoke.png`.

- [ ] **Step 2: Run visual check**

Run: `npm.cmd run visual:agent-browser`

Expected: PASS and screenshot written.

- [ ] **Step 3: Run full verifier**

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`

Expected: PASS.

## One-Shot LLM Prompt

You are implementing Linear TK-37 in `agent-browser`: Add multitask subagents and branch isolation. Create a deterministic browser-local multitask orchestration slice that plans 2-4 subagent branches for a larger request, assigns each a stable branch/worktree label, compares outputs, and lets the operator promote one branch into the foreground workflow. Keep it aligned with current Agent Browser architecture: pure service in `agent-browser/src/services/multitaskSubagents.ts`, durable state through `sessionState.ts`, React UI in the existing sidebar `App.tsx`, styling in `App.css`, focused Vitest/App smoke tests, and visual smoke coverage. Do not implement real git worktree creation in this slice; represent branch isolation intent and promotion state so later backend work can attach real worktrees.
