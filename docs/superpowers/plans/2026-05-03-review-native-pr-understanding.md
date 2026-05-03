# Review-Native PR Understanding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a review-native PR understanding surface in Agent Browser that groups related changes, explains intent, highlights risk, links validation/browser evidence, and turns reviewer comments into follow-up run prompts.

**Architecture:** Add a pure `prReviewUnderstanding` model that converts PR artifacts into deterministic review sections, then render that model through a focused `PullRequestReviewPanel` feature component. Wire the panel into the existing Activity Bar/sidebar architecture as a first-class Review panel without adding network or GitHub API dependencies.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, existing Agent Browser CSS and lucide icon patterns.

---

## Feature Implementation Plan

TK-47 asks for a dedicated review workflow rather than another raw chat summary. The narrow implementation is an offline-first review cockpit that can be seeded from PR metadata, changed files, validation commands, and browser evidence. It should be deterministic so later work can attach real GitHub/AgentBus inputs without changing the UI contract.

## Technical Spec

### Data Model

- `PullRequestReviewInput`: PR title, author, summary, changed files, validation items, browser evidence, and reviewer comments.
- `PullRequestReviewReport`: grouped changes, risk findings, validation evidence, follow-up prompts, and a review readiness score.
- `PullRequestChangeGroup`: semantic group with title, intent, files, risk level, and evidence links.
- `PullRequestRiskFinding`: concise reviewer-facing risk with severity, reason, and recommended check.
- `PullRequestFollowUpPrompt`: one-shot prompt text suitable for the active chat/session.

### Grouping Rules

- `agent-browser/src/chat-agents/**` -> Agent routing and behavior.
- `agent-browser/src/services/**` and `agent-browser/src/tools/**` -> Runtime services and tools.
- `agent-browser/src/features/**`, `agent-browser/src/App.tsx`, `agent-browser/src/App.css` -> User-facing review surface.
- `agent-browser/evals/**`, `agent-browser/scripts/**`, `**/*.test.ts`, `**/*.test.tsx` -> Validation and eval coverage.
- `docs/**`, `output/playwright/**`, `**/*.png` -> Review evidence and documentation.
- Unknown paths are grouped under Repository changes.

### Risk Rules

- High risk when files or summaries mention auth, tokens, secrets, provider routing, tool execution, shell, or permissions.
- Medium risk when files touch persistence, local/session storage, workspace state, model selection, or MCP integration.
- Low risk for CSS/docs/screenshots unless paired with missing validation.
- Missing validation creates an explicit review risk.

### UI Contract

- Add `review` to `SidebarPanel`, `PRIMARY_NAV`, shortcut order, and sidebar metadata.
- Render `PullRequestReviewPanel` for the `review` sidebar.
- The panel should show:
  - PR headline and review readiness.
  - grouped semantic change cards.
  - risk findings.
  - validation/browser evidence links.
  - reviewer comment cards and follow-up prompt buttons.
- Clicking a follow-up prompt should paste a review request into the current chat composer and switch back to the workspace/chat context.

### One-Shot LLM Prompt

```text
Implement TK-47 in agent-browser. Add an offline-first review-native PR understanding surface that transforms PR metadata, changed files, validation results, browser evidence, and reviewer comments into a deterministic review report. The report must group related changes semantically, summarize intent, highlight risk, link validation/browser evidence, and produce follow-up prompts that can be inserted into the current Agent Browser chat session. Add a first-class Review sidebar panel using existing Activity Bar/sidebar patterns, with focused unit tests for the grouping/risk model and React tests for the panel interactions. Keep the implementation deterministic and dependency-free so future GitHub or AgentBus inputs can feed the same model.
```

## File Structure

- Create `agent-browser/src/services/prReviewUnderstanding.ts` for the pure report builder and sample input factory.
- Create `agent-browser/src/services/prReviewUnderstanding.test.ts` for red/green model coverage.
- Create `agent-browser/src/features/pr-review/PullRequestReviewPanel.tsx` for the Review sidebar UI.
- Create `agent-browser/src/features/pr-review/PullRequestReviewPanel.test.tsx` for rendering and follow-up interaction coverage.
- Modify `agent-browser/src/App.tsx` to add the Review panel nav item, icon mapping, sidebar rendering, and follow-up chat insertion.
- Modify `agent-browser/src/App.css` for compact, responsive review-panel styling.

## Implementation Tasks

### Task 1: Review Understanding Model

**Files:**
- Create: `agent-browser/src/services/prReviewUnderstanding.test.ts`
- Create: `agent-browser/src/services/prReviewUnderstanding.ts`

- [ ] **Step 1: Write failing tests**

```bash
npm.cmd --workspace agent-browser run test -- src/services/prReviewUnderstanding.test.ts
```

Expected: FAIL because `prReviewUnderstanding.ts` does not exist.

- [ ] **Step 2: Implement the model**

Implement deterministic grouping, risk finding, readiness, evidence, and follow-up prompt generation.

- [ ] **Step 3: Verify green**

```bash
npm.cmd --workspace agent-browser run test -- src/services/prReviewUnderstanding.test.ts
```

Expected: PASS.

### Task 2: Review Panel UI

**Files:**
- Create: `agent-browser/src/features/pr-review/PullRequestReviewPanel.test.tsx`
- Create: `agent-browser/src/features/pr-review/PullRequestReviewPanel.tsx`

- [ ] **Step 1: Write failing component tests**

```bash
npm.cmd --workspace agent-browser run test -- src/features/pr-review/PullRequestReviewPanel.test.tsx
```

Expected: FAIL because the panel component does not exist.

- [ ] **Step 2: Implement the panel**

Render report summary, groups, risks, evidence, comments, and follow-up prompt buttons.

- [ ] **Step 3: Verify green**

```bash
npm.cmd --workspace agent-browser run test -- src/features/pr-review/PullRequestReviewPanel.test.tsx
```

Expected: PASS.

### Task 3: App Wiring And Styling

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`

- [ ] **Step 1: Add failing integration assertion**

Run existing App tests after wiring expectations around the Review nav where practical:

```bash
npm.cmd --workspace agent-browser run test -- src/App.test.tsx
```

- [ ] **Step 2: Wire the Review panel**

Add `review` to sidebar panel types, nav arrays, metadata, icon map, and `renderSidebarContent`. Make follow-up actions insert text into the active chat composer.

- [ ] **Step 3: Add CSS**

Use compact dark sidebar styling, stable spacing, no nested cards, responsive grids, and visible focus states.

### Task 4: Verification And PR

- [ ] **Step 1: Run targeted tests**

```bash
npm.cmd --workspace agent-browser run test -- src/services/prReviewUnderstanding.test.ts src/features/pr-review/PullRequestReviewPanel.test.tsx
```

- [ ] **Step 2: Run full repo gate**

```bash
npm.cmd run verify:agent-browser
```

- [ ] **Step 3: Run visual review**

Use the existing visual smoke script and include the screenshot in the PR description:

```bash
npm.cmd run visual:agent-browser
```

- [ ] **Step 4: Publish**

Use `scripts/codex-git.ps1` and `scripts/codex-gh.ps1` to commit, push, open a PR, add `codex` and `codex-automation` labels, link TK-47, and move Linear to Done after the PR exists and verification is documented.

## Self-Review

- Spec coverage: grouping, intent summary, risk highlighting, validation/browser evidence, reviewer follow-up prompts, and sidebar UI are covered.
- Placeholder scan: no implementation placeholder steps are left.
- Type consistency: model and component names match the planned file structure.
