# Improved Chat Rendering Implementation Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Add per-message copy controls for chat messages so users can copy message content as markdown or plaintext through the app's existing clipboard feature.

**Linear issue:** TK-9, "Improved Chat rendering".

## Technical Spec

- Every rendered chat message with a sender and non-empty `.message-bubble` gets compact copy controls beside the sender row.
- `Copy markdown` serializes rendered chat markup into readable markdown, preserving headings, emphasis, inline code, links, lists, blockquotes, code blocks, and paragraph breaks.
- `Copy plaintext` copies normalized readable text from the message bubble.
- Copy actions call `navigator.clipboard.writeText` and dispatch a synthetic `copy` event with `text/plain` content so the existing clipboard history listener can ingest chat copies.
- Controls are idempotent under React rerenders and MutationObserver rescans.
- Controls stay compact, hidden until hover/focus, and avoid shifting message bubble layout.

## Architecture

The low-risk implementation keeps `App.tsx` untouched for this PR and installs a focused DOM enhancer from `agent-browser/src/main.tsx`:

- `agent-browser/src/services/chatMessageCopy.ts`: deterministic markdown/plaintext formatting helpers.
- `agent-browser/src/services/chatMessageCopyControls.ts`: MutationObserver-based control installation and clipboard event dispatch.
- `agent-browser/src/index.css`: compact message action styles.
- Unit tests cover formatter behavior, DOM control installation, clipboard writes, event dispatch, duplicate prevention, and missing clipboard handling.

This aligns with the current app because chat messages already render stable `.message`, `.message-sender`, `.sender-name`, and `.message-bubble` structure, while the app clipboard feature already listens for document `copy` events.

## One-Shot LLM Prompt

Implement Linear issue TK-9 in `agent-browser`. Add per-message markdown/plaintext copy controls for rendered chat messages. Use TDD: first add tests for markdown/plaintext formatting and DOM control behavior, then implement `chatMessageCopy.ts` and `chatMessageCopyControls.ts`. Install controls from `main.tsx`, style them in `index.css`, and make copy actions call `navigator.clipboard.writeText` plus dispatch a `copy` event so existing clipboard history can observe the copy. Verify with targeted Vitest tests, `npm --workspace agent-browser run lint`, `npm run verify:agent-browser`, and `npm run visual:agent-browser`.

## TDD Plan

### Task 1: Formatter

1. Add failing tests for markdown pass-through, plaintext conversion, DOM-to-markdown serialization, DOM-to-plaintext serialization, and missing message bubbles.
2. Implement `ClipboardCopyFormat`, `formatMessageCopyContent`, `createMessageCopyLabel`, and `messageElementToCopyContent`.
3. Run `npm --workspace agent-browser run test -- src/services/chatMessageCopy.test.ts`.

### Task 2: DOM Controls

1. Add failing tests for adding markdown/plaintext buttons to a rendered chat message.
2. Add failing tests proving markdown/plaintext buttons write to the clipboard and dispatch `copy` events.
3. Add duplicate prevention and missing clipboard/sender/bubble coverage.
4. Implement `installChatMessageCopyControls` with a MutationObserver and idempotent enhancement.

### Task 3: App Integration

1. Import and call `installChatMessageCopyControls()` from `agent-browser/src/main.tsx` after service worker setup.
2. Add compact CSS for `.message-actions` and `.message-action-button` in `agent-browser/src/index.css`.
3. Verify hover/focus visibility and fixed button dimensions.

### Task 4: Verification

1. Run targeted tests for the two new service test files.
2. Run `npm --workspace agent-browser run lint`.
3. Run `npm run verify:agent-browser`.
4. Run `npm run visual:agent-browser` and include the screenshot in the PR when the environment allows it.

## Current Verification Notes

- `npm --workspace agent-browser run test -- src/services/chatMessageCopy.test.ts src/services/chatMessageCopyControls.test.ts` passes.
- `npm audit --audit-level=moderate` passes with `found 0 vulnerabilities`.
- `npm run verify:agent-browser` passes, including lint, full Vitest coverage run, build, audit, and visual smoke.
- Visual smoke wrote `output/playwright/agent-browser-visual-smoke.png`.
