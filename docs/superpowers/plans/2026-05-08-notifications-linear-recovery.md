# TK-26 Notifications Recovery Plan

## Linear Source

- Issue: `TK-26 Notifications`
- Requirement: enable browser notifications for task/work-item completion and user elicitation events in session chats.
- Recovery context: this issue was in Linear state `Canceled`, but the current checkout already contains the feature implementation. This run reclaims the issue, verifies the implementation, adds the missing repeatable retrieval script for canceled Linear work, and closes the remaining visual-coverage gap.

## Feature Implementation Plan

1. Keep the existing first-class notification implementation:
   - `agent-browser/src/services/browserNotifications.ts`
   - `agent-browser/src/services/browserNotifications.test.ts`
   - `STORAGE_KEYS.browserNotificationSettings`
   - `ChatPanel` titlebar toggle and completion/elicitation dispatch in `agent-browser/src/App.tsx`
   - App integration coverage in `agent-browser/src/App.integration.test.tsx`
2. Add automation support:
   - `scripts/list-linear-canceled-issues.mjs` lists canceled TK issues from either `LINEAR_API_KEY` GraphQL access or stdin JSON from the connected Linear tool.
   - Automation memory records the script path and command shape.
3. Add visual-smoke coverage for the notification toggle so the UI remains navigable and visible in the chat titlebar.
4. Validate focused service/App behavior, script regression checks, visual smoke, and the full `verify:agent-browser` gate where the Windows sandbox allows it.
5. Update Linear with exact validation evidence and move `TK-26` to `Done` only after the local delivery state is verified.

## Technical Spec

The notification feature remains scoped to the current Agent Browser app shell.

- Permission and dedupe logic stays in the pure `browserNotifications` service.
- Persistence stays in `sessionState.ts` under `agent-browser.browser-notification-settings`.
- The UI remains a compact icon button in the existing chat titlebar next to location, branching, and share controls.
- Completion notifications use `Session work complete`.
- User-input notifications use `Agent needs input` and are emitted when completed assistant text matches elicitation patterns such as questions, approval requests, or choice prompts.
- Visual smoke should open the Agent Browser shell and assert the notification button by accessible label, proving the control is present without requesting browser permission.

## One-Shot LLM Prompt

You are recovering Linear `TK-26 Notifications` in `agent-browser`. The feature code already exists in the current checkout, so do not duplicate it. Verify the implementation and fill only real gaps. Add a reusable canceled-Linear retrieval script under `scripts/`, record it in automation memory, and add visual-smoke coverage that asserts the chat titlebar exposes `Enable browser notifications`. Use TDD for the visual-smoke coverage by first adding the failing `run-script-tests.mjs` assertion, then updating `visual-smoke.mjs`, then running focused tests and the full `npm.cmd run verify:agent-browser` gate if possible. Update Linear with exact results.

## TDD Task Breakdown

- [x] Confirm `TK-26` is moved to `In Progress` before deeper work.
- [x] Add `scripts/list-linear-canceled-issues.mjs` and use it against the canceled issue list.
- [x] RED: add a script-regression assertion that visual smoke must check `Enable browser notifications`.
- [x] GREEN: update `agent-browser/scripts/visual-smoke.mjs` to assert the notification button.
- [x] Run focused direct behavior proof for browser notification service logic.
- [x] Run `npm.cmd --workspace agent-browser run test:scripts`.
- [x] Run `npm.cmd run visual:agent-browser`.
- [x] Run `npm.cmd run verify:agent-browser`.
- [x] Update Linear and automation memory with exact pass details.

## Validation Evidence

- `node --check scripts/list-linear-canceled-issues.mjs` passed.
- `node scripts/list-linear-canceled-issues.mjs --from-json -` passed for both the current Linear-tool issue shape and a GraphQL-shaped fixture.
- `npm.cmd --workspace agent-browser run test:scripts` passed after the RED/GREEN visual-smoke assertion loop.
- `node --experimental-strip-types --input-type=module ...browserNotifications.ts` passed, covering persisted-setting validation, completion dispatch, dedupe, elicitation detection, and elicitation notification formatting.
- `node --check agent-browser/scripts/visual-smoke.mjs` passed.
- `node --check agent-browser/scripts/run-script-tests.mjs` passed.
- `scripts/codex-git.ps1 diff --check` passed.
- `npm.cmd --workspace agent-browser run test -- src/services/browserNotifications.test.ts src/services/sessionState.test.ts` passed: 2 files, 33 tests.
- `npm.cmd --workspace agent-browser run test:app -- src/App.integration.test.tsx -t "browser notifications|session chat work completes|assistant response needs user input"` passed: 1 file, 3 tests.
- `npm.cmd run visual:agent-browser` passed and wrote `output/playwright/agent-browser-visual-smoke.png`; the stable review copy is `docs/superpowers/plans/2026-05-08-notifications-linear-recovery-visual-smoke.png`.
- `npm.cmd run verify:agent-browser` passed end to end: source hygiene, eval validation/tests, script tests, eval workflows, extension lint/coverage/build, agent-browser lint/coverage/build, audit lockfile, audit, and visual smoke.
