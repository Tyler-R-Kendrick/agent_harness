# Browser Evidence Diff Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tie browser screenshots, console/network checks, and structured assertions directly to changed files and the selected diff in Agent Browser.

**Architecture:** Add a pure `browserEvidenceReview` service that normalizes evidence artifacts, links them to changed worktree files, and computes selected-file readiness. Render the resulting report inside the existing `GitWorktreePanel` so code review happens beside the diff preview, while keeping the current `PullRequestReviewPanel` intact.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Playwright visual smoke, existing `@pierre/trees` and `@pierre/diffs` worktree UI.

---

## Feature Implementation Plan

Linear TK-23 asks for a verification flow where browser automation evidence is captured and associated with code changes before PR handoff. The first complete slice will make Agent Browser show browser evidence in the dashboard worktree review surface:

- Build deterministic browser evidence review data from changed files plus evidence artifacts.
- Link evidence to exact changed paths by explicit `relatedFiles`, `sourceFile`, or path-prefix fallback.
- Surface selected-file evidence next to the diff, including artifact path, kind, status, assertion counts, console errors, and network failures.
- Keep clean/unavailable worktree states readable and avoid blocking the diff viewer when no evidence is available.
- Add checked regression coverage for service behavior, panel rendering, App smoke, and visual-smoke assertions.

## Architecture-Aligned Technical Spec

### Files

- Create `agent-browser/src/services/browserEvidenceReview.ts`
  - Defines browser evidence artifact, assertion, file summary, and review report types.
  - Exports `buildBrowserEvidenceReview`, `createSampleBrowserEvidenceArtifacts`, and small formatting helpers.
  - Has no React dependency and no browser API dependency.

- Create `agent-browser/src/services/browserEvidenceReview.test.ts`
  - Verifies explicit file linking, fallback path linking, selected-file summaries, status rollups, and empty evidence behavior.

- Modify `agent-browser/src/features/worktree/GitWorktreePanel.tsx`
  - Accepts optional `browserEvidenceReview`.
  - Renders an evidence band in the worktree header.
  - Renders selected-file evidence below the diff header and before the virtualized patch.

- Modify `agent-browser/src/features/worktree/GitWorktreePanel.test.tsx`
  - Adds a failing test that expects selected diff evidence and assertion status to render for `src/App.tsx`.

- Modify `agent-browser/src/App.tsx`
  - Builds sample browser evidence artifacts for current Agent Browser visual smoke.
  - Builds a review report from `gitWorktreeStatus`, `selectedGitWorktreePath`, and evidence artifacts.
  - Passes the report into `GitWorktreePanel`.

- Modify `agent-browser/src/App.smoke.test.tsx`
  - Asserts the dashboard worktree review shows browser evidence when the mocked git status is hydrated.

- Modify `agent-browser/scripts/visual-smoke.mjs`
  - Asserts the dashboard worktree review shows evidence linked to `agent-browser/src/App.tsx`.

- Modify `agent-browser/scripts/run-script-tests.mjs`
  - Asserts visual smoke keeps the evidence checks.

- Modify `agent-browser/src/App.css`
  - Adds compact, responsive `.git-worktree-evidence-*` styles consistent with the existing dark dashboard.

## TDD Task Plan

### Task 1: Evidence Review Service

**Files:**
- Create: `agent-browser/src/services/browserEvidenceReview.test.ts`
- Create: `agent-browser/src/services/browserEvidenceReview.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildBrowserEvidenceReview } from './browserEvidenceReview';

describe('browserEvidenceReview', () => {
  it('links browser artifacts to changed files and summarizes the selected diff file', () => {
    const report = buildBrowserEvidenceReview({
      changedFiles: [
        { path: 'agent-browser/src/App.tsx', status: 'modified', staged: false, unstaged: true, conflicted: false },
        { path: 'agent-browser/src/App.css', status: 'modified', staged: false, unstaged: true, conflicted: false },
      ],
      selectedPath: 'agent-browser/src/App.tsx',
      artifacts: [{
        id: 'visual-smoke',
        label: 'Agent Browser visual smoke',
        kind: 'screenshot',
        status: 'passed',
        path: 'output/playwright/agent-browser-visual-smoke.png',
        relatedFiles: ['agent-browser/src/App.tsx'],
        assertions: [
          { label: 'Diff panel visible', status: 'passed' },
          { label: 'Console is clean', status: 'passed' },
        ],
        consoleErrors: 0,
        networkFailures: 0,
      }],
    });

    expect(report.totalEvidence).toBe(1);
    expect(report.selectedFile?.path).toBe('agent-browser/src/App.tsx');
    expect(report.selectedFile?.evidenceCount).toBe(1);
    expect(report.selectedEvidence[0].label).toBe('Agent Browser visual smoke');
    expect(report.selectedEvidence[0].assertionSummary).toEqual({ passed: 2, failed: 0, pending: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test -- src/services/browserEvidenceReview.test.ts`

Expected: fail because `./browserEvidenceReview` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `browserEvidenceReview.ts` with typed artifact normalization, path normalization, file matching, status rollup, and selected-file filtering.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd --workspace agent-browser run test -- src/services/browserEvidenceReview.test.ts`

Expected: pass with no warnings.

### Task 2: Diff Panel Evidence UI

**Files:**
- Modify: `agent-browser/src/features/worktree/GitWorktreePanel.test.tsx`
- Modify: `agent-browser/src/features/worktree/GitWorktreePanel.tsx`
- Modify: `agent-browser/src/App.css`

- [ ] **Step 1: Write failing panel test**

Add a test that passes a `browserEvidenceReview` report for `src/App.tsx` and expects:

```ts
expect(within(panel).getByLabelText('Browser evidence for selected diff')).toBeInTheDocument();
expect(within(panel).getByText('Agent Browser visual smoke')).toBeInTheDocument();
expect(within(panel).getByText('2 assertions passed')).toBeInTheDocument();
expect(within(panel).getByText('output/playwright/agent-browser-visual-smoke.png')).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test -- src/features/worktree/GitWorktreePanel.test.tsx`

Expected: fail because `GitWorktreePanel` does not accept or render browser evidence.

- [ ] **Step 3: Implement UI**

Add an optional `browserEvidenceReview` prop. Render a compact top-level count and a selected-file evidence list inside the diff shell with semantic labels and no nested cards.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd --workspace agent-browser run test -- src/features/worktree/GitWorktreePanel.test.tsx`

Expected: pass with existing worktree tests still green.

### Task 3: App Wiring and Visual Smoke

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.smoke.test.tsx`
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Modify: `agent-browser/scripts/run-script-tests.mjs`

- [ ] **Step 1: Write failing App smoke expectations**

Add expectations after the dashboard render path:

```ts
expect(screen.getByLabelText('Browser evidence for selected diff')).toBeInTheDocument();
expect(screen.getByText('Agent Browser visual smoke')).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx`

Expected: fail because App does not pass evidence into the worktree panel.

- [ ] **Step 3: Implement App wiring**

Use `createSampleBrowserEvidenceArtifacts(activeWorkspace.name)` and `buildBrowserEvidenceReview` to feed `GitWorktreePanel`. Keep all evidence data deterministic and local.

- [ ] **Step 4: Add visual-smoke assertions**

Assert these strings in `visual-smoke.mjs`: `Browser evidence`, `Agent Browser visual smoke`, and `2 assertions passed`.

- [ ] **Step 5: Run verification**

Run focused tests first, then `npm.cmd --workspace agent-browser run test:scripts`, `npm.cmd run check:generated-files`, `npm.cmd run visual:agent-browser`, and finally `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`.

## One-Shot LLM Prompt

You are implementing Linear TK-23 in `agent-browser`. Add browser evidence to code and diff review by building a pure TypeScript `browserEvidenceReview` service, wiring it into the existing `GitWorktreePanel`, and extending smoke/visual checks. Use TDD: first add failing tests for evidence-to-file linking and selected-diff evidence rendering, then implement the minimal service/UI. Keep the feature deterministic and local: sample evidence should reference `output/playwright/agent-browser-visual-smoke.png`, console/network health, and structured assertions. Use the existing dark dashboard styling, small dense controls, accessible labels, mobile-safe wrapping, and no nested cards. Validate with focused tests, script tests, visual smoke, generated-file checks, and the full Agent Browser verifier.

## Self-Review

- Spec coverage: TK-23 capture/link/show requirements are covered by the service, Git worktree UI, App wiring, and visual-smoke assertions.
- Placeholder scan: no task uses TBD/TODO/fill-in language.
- Type consistency: the service report type is the same object passed to `GitWorktreePanel`.
- Visual evidence: `docs/superpowers/plans/2026-05-07-browser-evidence-diff-review-visual-smoke.png` and `docs/superpowers/plans/2026-05-07-browser-evidence-diff-review-mobile-smoke.png` capture the Git worktree review surface with browser evidence attached on desktop and phone viewports.
