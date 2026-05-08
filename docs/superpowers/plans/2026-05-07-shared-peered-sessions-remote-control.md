# Shared Peered Sessions Remote Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Agent Browser shared sessions first-class remote-control sessions with persistent audit state, explicit peer/device labels, and prompt-visible control context.

**Architecture:** Build on the existing `agent-browser/src/shared-chat` QR-paired WebRTC protocol instead of introducing a backend. Add a deterministic `sharedSessionControl` service for durable control state, audit entries, active session summaries, peer/device-labeled messages, and prompt context; wire ChatPanel to update that state as shared-session lifecycle events occur.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Playwright visual smoke, existing Agent Browser localStorage persistence.

---

## Linear Source

Issue: TK-13 Shared/Peered Sessions and Remote Control

Description: users need a secure standard method to link two Agent Browser apps so a peer can post events to a shared session, contribute chat messages under a remote user/device label, and continue an existing session from another device.

## Feature Implementation Plan

1. Preserve the existing QR-paired WebRTC shared chat as the transport and trust boundary.
2. Add durable shared-session control state that tracks whether remote control is enabled, active shared sessions, peer/device labels, and signed lifecycle events.
3. Format inbound peer chat messages so the transcript identifies the remote peer and posting device.
4. Expose remote-control prompt context so active agents know the session is shared, which peer/device is connected, and whether remote control events are allowed.
5. Render a compact active-session banner with peer/device identity, event count, and remote-control status.
6. Cover service behavior, ChatPanel smoke behavior, and visual smoke coverage.

## Technical Spec

### Data Model

`SharedSessionControlState`

- `enabled: boolean`
- `allowRemoteControl: boolean`
- `requirePairingConfirmation: boolean`
- `activeSessions: SharedSessionSummary[]`
- `audit: SharedSessionAuditEntry[]`

`SharedSessionSummary`

- `sessionId`, `workspaceName`
- `peerLabel`, `deviceLabel`
- `status: pairing-pending | active | ended`
- `eventCount`
- `lastEventAt`

`SharedSessionAuditEntry`

- `id`, `sessionId`, `event`, `actor`, `summary`, `createdAt`

### Service Responsibilities

`agent-browser/src/services/sharedSessionControl.ts`

- Validate persisted state with `isSharedSessionControlState`.
- Build and update active session summaries with `recordSharedSessionControlEvent`.
- Create peer/device-labeled transcript text with `formatSharedSessionPeerMessage`.
- Create prompt context with `buildSharedSessionControlPromptContext`.
- Bound audit history to avoid unbounded localStorage growth.

### App Integration

`agent-browser/src/services/sessionState.ts`

- Add `sharedSessionControlState: 'agent-browser.shared-session-control-state'`.

`agent-browser/src/App.tsx`

- Hydrate `sharedSessionControlState` in `ChatPanel`.
- Record `session.opened`, `pairing.confirmed`, `message.created`, and `session.ended` events.
- Use `formatSharedSessionPeerMessage` for inbound remote messages.
- Include `buildSharedSessionControlPromptContext(sharedSessionControlState, activeChatSessionId)` in workspace prompt context.
- Render the active shared-session banner with peer/device label, event count, and remote-control status.

`agent-browser/scripts/visual-smoke.mjs`

- Seed shared-session control state and assert the active banner shows peer/device and remote-control status.

## One-Shot LLM Prompt

You are implementing Linear TK-13 in `C:\Users\conta\.codex\worktrees\1fe2\agent-harness`. Use TDD. Build on the existing `agent-browser/src/shared-chat` QR/WebRTC protocol and add first-class remote-control session state. Create `agent-browser/src/services/sharedSessionControl.ts` plus tests that validate state persistence, audit bounding, active session summaries, peer/device-labeled transcript formatting, and prompt context. Wire the service through `sessionState.ts` and `ChatPanel` in `App.tsx`, rendering an active-session banner with peer/device label, event count, and remote-control status. Add App smoke and visual-smoke assertions. Validate with focused tests, `npm.cmd --workspace agent-browser run test:scripts`, `npm.cmd run visual:agent-browser`, and `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`. Commit, push, open a PR with screenshot evidence, resolve conflicts/status failures, and merge when green.

## TDD Task Plan

### Task 1: Shared Session Control Service

**Files:**
- Create: `agent-browser/src/services/sharedSessionControl.ts`
- Create: `agent-browser/src/services/sharedSessionControl.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for default validation, active-session event recording, peer/device-labeled transcript formatting, prompt context, and bounded audit history.

- [ ] **Step 2: Run red test**

Run: `npm.cmd --workspace agent-browser run test -- agent-browser/src/services/sharedSessionControl.test.ts`
Expected: FAIL because `./sharedSessionControl` does not exist.

- [ ] **Step 3: Implement service**

Add exported types, defaults, validator, event recorder, formatter, and prompt-context builder.

- [ ] **Step 4: Run green test**

Run: `npm.cmd --workspace agent-browser run test -- agent-browser/src/services/sharedSessionControl.test.ts`
Expected: PASS.

### Task 2: ChatPanel Wiring

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/src/App.smoke.test.tsx`

- [ ] **Step 1: Write failing App smoke test**

Seed shared-session control state, render the chat panel, and assert the banner shows the remote peer/device, event count, and remote-control status.

- [ ] **Step 2: Run red App test**

Run: `npm.cmd --workspace agent-browser run test:app -- agent-browser/src/App.smoke.test.tsx`
Expected: FAIL because the banner does not expose remote-control state yet.

- [ ] **Step 3: Implement app wiring**

Persist control state, update it from shared-chat callbacks, inject prompt context, and render the richer banner.

- [ ] **Step 4: Run green App test**

Run: `npm.cmd --workspace agent-browser run test:app -- agent-browser/src/App.smoke.test.tsx`
Expected: PASS.

### Task 3: Visual Smoke And PR

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`

- [ ] **Step 1: Add visual assertions**

Seed shared-session control state and assert the banner identity/status copy is visible.

- [ ] **Step 2: Run visual smoke**

Run: `npm.cmd run visual:agent-browser`
Expected: PASS and write screenshots.

- [ ] **Step 3: Run full verification**

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`
Expected: PASS.

- [ ] **Step 4: Publish and merge**

Commit, push, open PR, add `codex` and `codex-automation` labels, link Linear TK-13, resolve conflicts/status failures, and merge once checks are green.

## Self-Review

- Spec coverage: secure linking uses the existing QR/WebRTC pairing, remote event posting is tracked as shared-session control events, peer/device transcript labels are explicit, and session continuation context is prompt-visible.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: state, summary, audit, and prompt-context names are defined before use.
