# Browser Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable opt-in browser notifications when session chat work completes or an assistant turn asks the user for input.

**Architecture:** Add a small `browserNotifications` service that owns permission checks, settings validation, event formatting, and dedupe. Wire `ChatPanel` to persist a global opt-in setting, expose a header bell toggle, and emit notification events from the existing chat completion paths.

**Tech Stack:** React 18, TypeScript, Vitest, jsdom, Browser Notification API, existing `useStoredState` persistence.

---

## Feature Implementation Plan

1. Add a testable notification service under `agent-browser/src/services/browserNotifications.ts`.
2. Persist opt-in state through `STORAGE_KEYS.browserNotificationSettings`.
3. Add a bell icon button to the chat panel titlebar. Enabling requests browser permission; denied or unsupported states fall back to existing toast feedback.
4. Emit completion notifications from sandbox, tool-enabled, and direct chat completion paths.
5. Emit elicitation notifications when a completed assistant response appears to ask the user for a decision, confirmation, approval, permission, or choice.
6. Keep notifications opt-in, deduped by event id, and quiet unless permission is granted.

## Technical Spec

### Notification Service

Create `agent-browser/src/services/browserNotifications.ts`.

Exports:

- `DEFAULT_BROWSER_NOTIFICATION_SETTINGS`
- `isBrowserNotificationSettings(value)`
- `getBrowserNotificationPermission(api)`
- `requestBrowserNotificationPermission(api)`
- `createBrowserNotificationDispatcher(deps)`
- `buildChatCompletionNotification(input)`
- `buildChatElicitationNotification(input)`
- `isLikelyUserElicitation(text)`

Service rules:

- Unsupported API returns `unsupported`.
- Permission request only happens from the user-initiated toggle.
- `notify()` is a no-op unless settings are enabled and permission is `granted`.
- `notify()` dedupes repeated event ids.
- Completion title: `Session work complete`.
- Elicitation title: `Agent needs input`.
- Bodies include the session label and a compact content preview.

### ChatPanel Wiring

Modify `agent-browser/src/App.tsx`.

- Import bell icons from `lucide-react`.
- Import notification helpers from the new service.
- Add `browserNotificationSettings` with `useStoredState(localStorageBackend, STORAGE_KEYS.browserNotificationSettings, isBrowserNotificationSettings, DEFAULT_BROWSER_NOTIFICATION_SETTINGS)`.
- Add `notificationPermission` state initialized from `getBrowserNotificationPermission`.
- Add `handleToggleBrowserNotifications()`.
- Add `notifyAssistantComplete(assistantId, content)` and call it after existing `updateMessage(... status: 'complete' ...)` paths.
- Keep toast feedback for enable/disable/unsupported/denied states.
- Add a titlebar icon button with `aria-label="Enable browser notifications"` or `aria-label="Disable browser notifications"`.

### Tests

Add `agent-browser/src/services/browserNotifications.test.ts`.

Required service tests:

- rejects invalid persisted settings
- reports unsupported Notification API
- requests permission through the dependency boundary
- sends a completion notification when enabled and granted
- skips notification when disabled or denied
- dedupes repeated event ids
- detects decision/approval/question elicitation text

Modify `agent-browser/src/services/sessionState.test.ts`.

- Assert `STORAGE_KEYS.browserNotificationSettings` is listed.

Modify `agent-browser/src/App.test.tsx`.

- Test enabling notifications requests permission and stores enabled settings.
- Test a completed chat response emits `Session work complete`.
- Test an assistant response asking for confirmation emits `Agent needs input`.

## One-Shot LLM Prompt

You are working in `C:\Users\conta\.codex\worktrees\dc11\agent-harness` on Linear issue `TK-26 Notifications`. Implement opt-in browser notifications for agent-browser session chats. Follow TDD: add failing Vitest tests first, verify red, implement minimal production code, verify green, and run `npm run verify:agent-browser`.

Use the current architecture:

- App shell: `agent-browser/src/App.tsx`
- Persistence helpers: `agent-browser/src/services/sessionState.ts`
- Tests: `agent-browser/src/App.test.tsx`, `agent-browser/src/services/sessionState.test.ts`
- Add a small service: `agent-browser/src/services/browserNotifications.ts`

Requirements:

- Opt-in toggle in the chat panel titlebar using lucide bell icons.
- Persist settings under `agent-browser.browser-notification-settings`.
- Request Notification permission only from the toggle click.
- If unsupported or denied, show existing toast feedback and do not enable.
- When enabled and permission is granted, show native notifications for completed assistant work.
- Also show native notifications when an assistant response appears to require user input, such as confirmation, approval, permission, a choice, or a direct question.
- Deduplicate notifications by event id so React re-renders and repeated callbacks do not spam users.
- Keep visual changes compact and consistent with existing titlebar controls.

Verification:

- Targeted service tests pass.
- Targeted App tests pass.
- `npm run verify:agent-browser` passes.
- `npm run visual:agent-browser` produces `output/playwright/agent-browser-visual-smoke.png`.

## Task Breakdown

### Task 1: Notification Service

**Files:**
- Create: `agent-browser/src/services/browserNotifications.ts`
- Create: `agent-browser/src/services/browserNotifications.test.ts`

- [ ] Write failing tests for permission handling, settings validation, formatting, dedupe, and elicitation detection.
- [ ] Run `npm --workspace agent-browser run test -- src/services/browserNotifications.test.ts` and confirm failures for missing module.
- [ ] Implement the service with dependency injection around the Notification API.
- [ ] Re-run the targeted service test and confirm green.

### Task 2: Persistence Key

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/services/sessionState.test.ts`

- [ ] Add a failing assertion that `STORAGE_KEYS.browserNotificationSettings` exists.
- [ ] Run `npm --workspace agent-browser run test -- src/services/sessionState.test.ts`.
- [ ] Add the key value `agent-browser.browser-notification-settings`.
- [ ] Re-run the targeted test.

### Task 3: ChatPanel UI and Notification Emission

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.test.tsx`

- [ ] Add failing App tests for enabling notifications and sending completion/elicitation notifications.
- [ ] Run `npm --workspace agent-browser run test -- src/App.test.tsx -t "browser notifications"`.
- [ ] Add the chat titlebar toggle and notification callbacks in `ChatPanel`.
- [ ] Emit notification events after assistant completion paths.
- [ ] Re-run the targeted App tests.

### Task 4: Verification and Visual Review

**Files:**
- Potentially modify: `agent-browser/src/App.css`

- [ ] Run `npm --workspace agent-browser run test -- src/services/browserNotifications.test.ts src/services/sessionState.test.ts`.
- [ ] Run `npm --workspace agent-browser run test -- src/App.test.tsx -t "browser notifications"`.
- [ ] Run `npm run verify:agent-browser`.
- [ ] Run or confirm `npm run visual:agent-browser` screenshot output.
- [ ] Inspect the screenshot for titlebar fit and obvious layout regressions.

## Self-Review

Spec coverage: the plan covers opt-in permission flow, persisted settings, completion notifications, elicitation notifications, dedupe, tests, and visual validation.

Placeholder scan: no placeholder implementation steps remain.

Type consistency: notification settings and event names are centralized in the service, with App consuming exported helpers.
