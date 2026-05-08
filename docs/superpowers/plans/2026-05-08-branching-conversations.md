# Branching Conversations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable Agent Browser conversation branches/subthreads that can collect branch commits, merge summaries back into the main thread, and surface that graph in prompt context plus History/Settings/UI proof surfaces.

**Architecture:** Implement a pure `conversationBranches` service that owns the persisted state shape, validation, summary, prompt-context, and ProcessGraph row projection. Wire it through `sessionState`, `AgentBrowserApp`, `ChatPanel`, `HistoryPanel`, and `SettingsPanel` using the existing `useStoredState`, `ProcessGraph`, and prompt-context patterns.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, localStorage persistence, existing Agent Browser CSS and Playwright visual smoke.

---

## Feature Plan

TK-12 asks for Slack-style subthreads that behave like git branches: the subthread keeps the same ID over time, each update creates a new branch commit/summary, and the main thread consumes the newest merged branch summary as context. This first production slice keeps all behavior browser-local and deterministic:

- Users can start a branch from the active chat session through a header control or by sending a branch/subthread request.
- Branches are persisted per workspace with stable branch IDs, branch names, commit records, and merge metadata.
- Each branch commit updates the subthread summary while preserving the subthread ID.
- Merging a branch creates a main-thread commit and marks the branch's latest commit as merged.
- The main chat prompt context includes the latest merged and active branch summaries.
- History shows the branch graph activity; Settings exposes policy toggles.
- ProcessGraph-compatible rows allow the existing process UI to render branch rails without a separate graph renderer.

## Technical Spec

### State Model

Create `agent-browser/src/services/conversationBranches.ts` with:

- `ConversationBranchingState`: durable state keyed by `agent-browser.conversation-branching-state`.
- `ConversationSubthread`: stable subthread ID, title, branch name, status, latest summary, head commit ID, and last merged commit ID.
- `ConversationBranchCommit`: append-only commit records with one or more parent IDs, source session ID, message IDs, summary, branch ID, and merge timestamp.
- `ConversationBranchSettings`: `enabled`, `includeBranchContext`, `showProcessGraphNodes`, `autoSummarizeOnMerge`.

### Behavior

- `createConversationBranchingState()` creates one main commit plus one running branch commit from the request.
- `commitConversationSubthread()` appends a new commit to the existing subthread and keeps the subthread ID stable.
- `mergeConversationSubthread()` appends a main merge commit with parents `[mainHeadCommitId, branchHeadCommitId]`, updates `mainHeadCommitId`, and marks the subthread merged.
- `buildConversationBranchPromptContext()` emits compact context only when enabled and context injection is on.
- `buildConversationBranchProcessEntries()` maps branch commits to `ProcessEntry` rows with `kind: 'commit'`, `branchId`, and parent references for the existing ProcessGraph.
- `isConversationBranchingState()` validates persisted state so corrupted storage falls back safely.

### UI Wiring

- Add a new durable storage key in `sessionState`.
- Add a branch header button in `ChatPanel`; it creates or updates branch state for the active session.
- Detect branch/subthread requests in `sendMessage()` and start a branch state in addition to normal chat submission.
- Add `conversationBranchPromptContext` to the workspace prompt context.
- Add a `BranchingConversationSettingsPanel` under Settings.
- Add a `BranchingConversationHistory` section under History.

### Verification

- Unit tests cover state creation, stable subthread IDs across commits, merge commits, prompt context, ProcessGraph entries, and validation.
- Session-state tests cover the new storage key.
- App smoke tests cover Chat branch action, History graph summary, and Settings toggles.
- Visual smoke seeds branch state and asserts History/Settings branch surfaces are visible.
- Final gate: `npm.cmd run verify:agent-browser`.

## One-Shot LLM Prompt

Implement TK-12 in `agent-browser` as a durable browser-local conversation branching feature. Reuse existing Agent Browser patterns: put pure state logic in `agent-browser/src/services/conversationBranches.ts`, validate persisted state through `agent-browser/src/services/sessionState.ts`, store it under `agent-browser.conversation-branching-state`, inject compact prompt context into `ChatPanel`, and surface proof in History and Settings. The service must support stable subthread IDs, append-only branch commits, merge commits back to main, ProcessGraph-compatible rows, prompt-context rendering, and shape validation. Use TDD: first add failing tests in `conversationBranches.test.ts`, `sessionState.test.ts`, and `App.smoke.test.tsx`; then implement the minimal code. Add visual-smoke assertions and screenshot evidence for the visible UI. Finish with `npm.cmd run verify:agent-browser`, commit, push, open a PR with `codex` and `codex-automation` labels, resolve conflicts/status checks, and merge when green.

## TDD Task Breakdown

### Task 1: Pure Branch State Service

**Files:**
- Create: `agent-browser/src/services/conversationBranches.ts`
- Create: `agent-browser/src/services/conversationBranches.test.ts`

- [ ] Write failing tests for creating a branch state, appending commits while keeping the subthread ID stable, merging a branch into main, rendering prompt context, rendering ProcessGraph entries, and rejecting invalid persisted shapes.
- [ ] Run `npm.cmd --workspace agent-browser run test -- src/services/conversationBranches.test.ts` and confirm RED.
- [ ] Implement the service minimally.
- [ ] Rerun the focused service test and confirm GREEN.

### Task 2: Persistence Key

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/services/sessionState.test.ts`

- [ ] Add a failing assertion that `STORAGE_KEYS.conversationBranchingState` exists.
- [ ] Run the session-state test and confirm RED.
- [ ] Add the key under durable localStorage.
- [ ] Rerun the session-state test and confirm GREEN.

### Task 3: App UI and Prompt Context

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.smoke.test.tsx`

- [ ] Add failing smoke coverage for the chat header branch control, History branch section, and Settings branch controls.
- [ ] Run the focused App smoke test and confirm RED.
- [ ] Wire `conversationBranchingState` through `useStoredState`.
- [ ] Add `conversationBranchPromptContext` to `ChatPanel`.
- [ ] Add Chat, History, and Settings branch controls.
- [ ] Rerun the focused App smoke tests and confirm GREEN.

### Task 4: Visual Smoke

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Create: `docs/superpowers/plans/2026-05-08-branching-conversations-visual-smoke.png`

- [ ] Seed branch state in visual smoke localStorage.
- [ ] Assert visible History and Settings branch surfaces.
- [ ] Run `npm.cmd run visual:agent-browser`.
- [ ] Copy/check in the screenshot evidence.

### Task 5: Full Verification and Publish

**Files:**
- All changed files.

- [ ] Run `npm.cmd run verify:agent-browser`.
- [ ] Fix every lint, test, build, audit, or visual issue.
- [ ] Commit on `codex/tk-12-branching-conversations`.
- [ ] Push, open PR, add `codex` and `codex-automation` labels, link PR to Linear.
- [ ] Resolve merge conflicts and red checks.
- [ ] Merge when GitHub checks are green.
