# Chaptered Sessions and Context Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add chaptered browser-agent sessions with inspectable compressed context that links back to full trace evidence.

**Architecture:** Implement the core behavior in a pure `sessionChapters` service, persist durable state through `sessionState`, and expose the feature through existing Chat, History, Settings, and visual-smoke surfaces. Chat prompt construction receives compressed carry-forward context while History and Settings show both the compressed state and source evidence references.

**Tech Stack:** React, TypeScript, Vitest, Vite, Playwright visual smoke, localStorage-backed `useStoredState`.

---

## Feature Implementation Plan

TK-52 turns long raw browser-agent transcripts into navigable chapters. Each chapter records message boundaries, a human summary, compressed carry-forward context, evidence references, and validation references. Compression never deletes or hides the source trace; it gives prompt builders a bounded carry-forward packet while UI surfaces keep evidence handles inspectable.

## Technical Spec

### Files

- Create: `agent-browser/src/services/sessionChapters.ts`
- Create: `agent-browser/src/services/sessionChapters.test.ts`
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/services/sessionState.test.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.smoke.test.tsx`
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/scripts/visual-smoke.mjs`

### Data Model

`ChapteredSessionState` contains an enabled flag, compression policy, sessions, and audit rows. A `SessionChapter` belongs to one session, stores ordered message IDs, source trace references, evidence refs, validation refs, and a `CompressedSessionContext` object with token budget metadata and lossless evidence handles.

### UI Contract

History gets a `Chaptered sessions` section with latest chapter, chapter count, source trace refs, evidence refs, and validation refs. Settings gets a `Chaptered sessions` section with enablement, automatic compression controls, token budget, retention count, active metrics, and audit rows. Chat prompt context includes only the active session compressed context and explicitly instructs agents to cite source trace and evidence references when using it.

### One-Shot LLM Prompt

Implement TK-52 in `agent-browser`: add a pure `sessionChapters` service with validators, defaults, automatic chapter projection from chat messages, compressed prompt context generation, and sample state. Persist it under `agent-browser.session-chapter-state`. Wire the state into `App.tsx` so Settings can configure the policy, History can inspect chapter/source/evidence links, and Chat prompt context receives active-session compressed context. Follow existing Agent Browser patterns for `useStoredState`, settings sections, history cards, App smoke tests, and `visual-smoke.mjs`. Use TDD: write failing service, storage, App smoke, and visual-smoke assertions before implementation. Run focused tests, lint, full `verify:agent-browser`, commit, push, open PR, fix checks, and merge when green.

## TDD Checklist

### Task 1: Pure Session Chapters Service

- [ ] **Step 1: Write failing tests**

Create `agent-browser/src/services/sessionChapters.test.ts` with tests that assert default state validation, chapter projection from messages, compression summaries retaining source/evidence/validation refs, prompt context formatting, and malformed persisted state rejection.

- [ ] **Step 2: Run red test**

Run: `npm.cmd --workspace agent-browser run test -- src/services/sessionChapters.test.ts`

Expected: FAIL because `./sessionChapters` does not exist.

- [ ] **Step 3: Implement service**

Create `agent-browser/src/services/sessionChapters.ts` with exported defaults, validators, `projectSessionChapters`, `buildSessionCompressionPromptContext`, and `updateSessionChapterPolicy`.

- [ ] **Step 4: Run green test**

Run: `npm.cmd --workspace agent-browser run test -- src/services/sessionChapters.test.ts`

Expected: PASS.

### Task 2: Persistence Key and Validation

- [ ] **Step 1: Write failing storage test**

Modify `agent-browser/src/services/sessionState.test.ts` to assert `STORAGE_KEYS.sessionChapterState === 'agent-browser.session-chapter-state'`.

- [ ] **Step 2: Run red test**

Run: `npm.cmd --workspace agent-browser run test -- src/services/sessionState.test.ts`

Expected: FAIL because the key is absent.

- [ ] **Step 3: Add storage key**

Modify `agent-browser/src/services/sessionState.ts` to include `sessionChapterState`.

- [ ] **Step 4: Run green test**

Run: `npm.cmd --workspace agent-browser run test -- src/services/sessionState.test.ts src/services/sessionChapters.test.ts`

Expected: PASS.

### Task 3: App Wiring

- [ ] **Step 1: Write failing App smoke tests**

Add tests asserting Settings renders `Chaptered sessions`, History renders `Session chapters`, and Chat renders a compression context badge for a persisted session.

- [ ] **Step 2: Run red test**

Run: `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx`

Expected: FAIL because those UI surfaces do not exist.

- [ ] **Step 3: Wire state and UI**

Use `useStoredState` in `App.tsx`; pass state to `ChatPanel`, `HistoryPanel`, and `SettingsPanel`; render settings/history cards; include prompt context in `workspacePromptContext`; add compact CSS.

- [ ] **Step 4: Run green test**

Run: `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx src/services/sessionChapters.test.ts src/services/sessionState.test.ts`

Expected: PASS.

### Task 4: Visual Smoke and Full Verification

- [ ] **Step 1: Add visual-smoke assertions**

Modify `agent-browser/scripts/visual-smoke.mjs` seed data to include session chapter state and assert the Settings/History labels are visible.

- [ ] **Step 2: Run visual review**

Run: `npm.cmd run visual:agent-browser`

Expected: PASS and screenshot updates to `output/playwright/agent-browser-visual-smoke.png`.

- [ ] **Step 3: Copy PR screenshot**

Copy the visual smoke screenshot to `docs/superpowers/plans/2026-05-08-chaptered-sessions-context-compression-visual-smoke.png`.

- [ ] **Step 4: Run full verifier**

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`

Expected: PASS including lint, coverage, build, audit, and visual smoke.

### Task 5: Publish

- [ ] **Step 1: Commit**

Run: `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/codex-git.ps1 add agent-browser/src/services/sessionChapters.ts agent-browser/src/services/sessionChapters.test.ts agent-browser/src/services/sessionState.ts agent-browser/src/services/sessionState.test.ts agent-browser/src/App.tsx agent-browser/src/App.smoke.test.tsx agent-browser/src/App.css agent-browser/scripts/visual-smoke.mjs docs/superpowers/plans/2026-05-08-chaptered-sessions-context-compression.md docs/superpowers/plans/2026-05-08-chaptered-sessions-context-compression-visual-smoke.png`

Run: `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/codex-git.ps1 commit -m "feat: add chaptered session compression"`

- [ ] **Step 2: Push and open PR**

Run: `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/codex-git.ps1 push -u origin codex/tk-52-chaptered-sessions`

Run: `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/codex-gh.ps1 pr create --title "Add chaptered session compression" --body-file <generated-body>`

- [ ] **Step 3: Fix checks and merge**

Poll PR checks, fix any failures locally, push again, and squash-merge once GitHub reports green and clean.

## Self-Review

Spec coverage: chapter visibility is covered by History and visual smoke; inspectable summaries and source/evidence links are covered by the service model and History cards; compressed carry-forward context is covered by Chat prompt context; policy/review visibility is covered by Settings and prompt context.

Placeholder scan: no TODO/TBD placeholder steps remain.

Type consistency: the plan consistently uses `ChapteredSessionState`, `SessionChapter`, `CompressedSessionContext`, `sessionChapterState`, and `buildSessionCompressionPromptContext`.
