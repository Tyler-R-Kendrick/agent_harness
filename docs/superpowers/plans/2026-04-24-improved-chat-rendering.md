# Improved Chat Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-message copy controls for chat messages so users can copy message content as markdown or plaintext through the app's existing clipboard feature.

**Architecture:** Keep rendering in `agent-browser/src/App.tsx`, but move deterministic message-formatting behavior into `agent-browser/src/services/chatMessageCopy.ts` so it can be tested without DOM setup. `App` will pass the existing `writeToClipboard` flow into `ChatMessageView`, which keeps clipboard history, system clipboard state, and toast behavior consistent with Copy URI and session sharing.

**Publishing note:** The implemented PR uses a small `main.tsx` DOM enhancer (`agent-browser/src/services/chatMessageCopyControls.ts`) instead of committing the large `App.tsx` integration directly because this sandbox cannot write the local git index and connector-only full-file updates for `App.tsx`/`App.test.tsx` are impractical. The enhancer preserves the same user-facing behavior: per-message markdown/plaintext controls, `navigator.clipboard.writeText`, and a synthetic `copy` event that feeds the existing clipboard history listener.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, lucide-react icons, existing `navigator.clipboard.writeText` integration.

---

## Linear Requirement

Issue TK-9, "Improved Chat rendering":

> The chat needs to support copy/paste of messages with richer copy (copy as markdown, copy as plaintext, etc). Make sure that uses and interacts with the clipboard feature.

## Technical Spec

### Behavior

- Every rendered chat message with non-empty content shows compact copy actions beside the sender row.
- `Copy markdown` copies the exact message source text, preserving markdown syntax and line breaks.
- `Copy plaintext` copies a readable text form:
  - Markdown links become `label (url)`.
  - Inline code keeps its inner text.
  - Emphasis markers are removed.
  - Headings, lists, blockquotes, fenced code text, and paragraphs remain readable with normalized whitespace.
- Copy actions use the existing app clipboard writer, so copied chat content appears in Clipboard history and updates `lastClipboardTextRef`.
- Success and failure feedback use existing toast behavior.
- System messages are still visually quiet but copyable when they have content.
- Streaming messages copy whatever content is currently visible.

### Non-Goals

- No new markdown editor.
- No custom native paste handling.
- No clipboard MIME bundle; this iteration writes text to `navigator.clipboard.writeText`.
- No refactor of the large `App.tsx` structure beyond the local copy integration.

### File Map

- Create `agent-browser/src/services/chatMessageCopy.ts`
  - Exports `formatMessageCopyContent(content, format)`, `createMessageCopyLabel(senderLabel, format)`, and associated types.
- Create `agent-browser/src/services/chatMessageCopy.test.ts`
  - Covers markdown pass-through, plaintext conversion, whitespace normalization, and label generation.
- Create `agent-browser/src/services/chatMessageCopyControls.ts`
  - Adds compact markdown/plaintext buttons to rendered chat messages and dispatches clipboard events.
- Create `agent-browser/src/services/chatMessageCopyControls.test.ts`
  - Covers DOM control installation, markdown/plaintext writes, duplicate prevention, and missing clipboard handling.
- Modify `agent-browser/src/main.tsx`
  - Installs the message copy controls after service-worker setup.
- Modify `agent-browser/src/index.css`
  - Adds compact action styling shared by the DOM-enhanced message controls.
- Modify `agent-browser/src/App.tsx`
  - Imports helper functions and `ClipboardCopyFormat`.
  - Adds `onCopyMessage` callback prop to `ChatMessageView`.
  - Renders icon-only message copy controls with accessible labels and tooltips.
  - Wires chat copy controls to existing `writeToClipboard` and `setToast`.
- Modify `agent-browser/src/App.test.tsx`
  - Adds integration tests proving markdown/plaintext copy calls `navigator.clipboard.writeText` and populates Clipboard history.
- Modify `agent-browser/src/App.css`
  - Adds compact message action styling that does not shift message layout or overlap content.

## One-Shot LLM Prompt

Implement Linear issue TK-9 in the `agent-browser` workspace. Add per-message copy controls to the React chat transcript. Use TDD. First add `agent-browser/src/services/chatMessageCopy.test.ts` covering markdown pass-through, plaintext conversion of links/emphasis/code/lists, whitespace normalization, and clipboard labels. Then implement `agent-browser/src/services/chatMessageCopy.ts`. Next add Testing Library coverage in `agent-browser/src/App.test.tsx` that renders a chat response, clicks `Copy message as markdown` and `Copy message as plaintext`, asserts `navigator.clipboard.writeText` receives the right values, and confirms copied entries appear in the existing Clipboard history. Then update `agent-browser/src/App.tsx` so `ChatMessageView` renders compact icon buttons for each non-empty message and calls the existing `writeToClipboard` function from the app shell. Style the controls in `agent-browser/src/App.css` to be compact, accessible, visually consistent with existing icon buttons, and stable on narrow viewports. Finish with `npm --workspace agent-browser run test -- src/services/chatMessageCopy.test.ts src/App.test.tsx`, `npm run verify:agent-browser`, and `npm run visual:agent-browser`.

---

### Task 1: Message Copy Formatter

**Files:**
- Create: `agent-browser/src/services/chatMessageCopy.test.ts`
- Create: `agent-browser/src/services/chatMessageCopy.ts`

- [ ] **Step 1: Write the failing formatter tests**

```ts
import { describe, expect, it } from 'vitest';
import { createMessageCopyLabel, formatMessageCopyContent } from './chatMessageCopy';

describe('formatMessageCopyContent', () => {
  it('returns markdown content unchanged for markdown copy', () => {
    const source = '## Result\n\nUse **bold** and [docs](https://example.test).';
    expect(formatMessageCopyContent(source, 'markdown')).toBe(source);
  });

  it('converts markdown links, emphasis, code, and list markers into readable plaintext', () => {
    const source = '## Result\n\n- Use **bold** and `code`\n- Read [docs](https://example.test)';
    expect(formatMessageCopyContent(source, 'plaintext')).toBe('Result\n\nUse bold and code\nRead docs (https://example.test)');
  });

  it('normalizes excessive blank lines and trims copied plaintext', () => {
    const source = '\n\nFirst paragraph\n\n\n\n> quoted text\n\n';
    expect(formatMessageCopyContent(source, 'plaintext')).toBe('First paragraph\n\nquoted text');
  });
});

describe('createMessageCopyLabel', () => {
  it('includes sender and format for clipboard history', () => {
    expect(createMessageCopyLabel('codi', 'markdown')).toBe('Chat codi message (markdown)');
    expect(createMessageCopyLabel('you', 'plaintext')).toBe('Chat you message (plaintext)');
  });
});
```

- [ ] **Step 2: Run formatter tests to verify RED**

Run: `npm --workspace agent-browser run test -- src/services/chatMessageCopy.test.ts`

Expected: FAIL because `./chatMessageCopy` does not exist.

- [ ] **Step 3: Implement the formatter**

```ts
export type ClipboardCopyFormat = 'markdown' | 'plaintext';

export function formatMessageCopyContent(content: string, format: ClipboardCopyFormat): string {
  if (format === 'markdown') return content;
  return markdownToPlaintext(content);
}

export function createMessageCopyLabel(senderLabel: string, format: ClipboardCopyFormat): string {
  return `Chat ${senderLabel} message (${format})`;
}

function markdownToPlaintext(content: string): string {
  return content
    .replace(/\r\n?/g, '\n')
    .replace(/```[\w-]*\n([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

- [ ] **Step 4: Run formatter tests to verify GREEN**

Run: `npm --workspace agent-browser run test -- src/services/chatMessageCopy.test.ts`

Expected: PASS.

### Task 2: Chat Message Copy UI

**Files:**
- Modify: `agent-browser/src/App.test.tsx`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`

- [ ] **Step 1: Write failing integration tests**

Add tests to `agent-browser/src/App.test.tsx` near the existing chat tests:

```ts
it('copies an assistant message as markdown through the clipboard feature', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });
  generateMock.mockImplementation(async (_input, callbacks) => {
    callbacks.onToken?.('## Result\n\nUse **bold** and [docs](https://example.test).');
  });

  vi.useFakeTimers();
  render(<App />);
  await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

  fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Summarize this.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await act(async () => { await Promise.resolve(); });

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Copy codi message as markdown' }));
    await Promise.resolve();
  });

  expect(writeText).toHaveBeenCalledWith('## Result\n\nUse **bold** and [docs](https://example.test).');
  expect(screen.getByText('Message copied as markdown')).toBeInTheDocument();

  const cbRow = screen.getByRole('button', { name: 'Clipboard' }).closest('[role="treeitem"]')!;
  fireEvent.contextMenu(cbRow);
  fireEvent.click(screen.getByRole('menuitem', { name: 'History' }));
  expect(screen.getByText('Chat codi message (markdown)')).toBeInTheDocument();
});

it('copies a user message as plaintext through the clipboard feature', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });

  vi.useFakeTimers();
  render(<App />);
  await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });

  fireEvent.change(screen.getByLabelText('Chat input'), { target: { value: 'Use **bold** and [docs](https://example.test).' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await act(async () => { await Promise.resolve(); });

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Copy you message as plaintext' }));
    await Promise.resolve();
  });

  expect(writeText).toHaveBeenCalledWith('Use bold and docs (https://example.test).');
  expect(screen.getByText('Message copied as plaintext')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run integration tests to verify RED**

Run: `npm --workspace agent-browser run test -- src/App.test.tsx -t "copies .* message as"`

Expected: FAIL because the copy buttons are not rendered.

- [ ] **Step 3: Implement message copy controls**

Implementation details:
- Import `ClipboardCopyFormat`, `createMessageCopyLabel`, and `formatMessageCopyContent`.
- Add `onCopyMessage?: (input: { content: string; senderLabel: string; format: ClipboardCopyFormat }) => Promise<void>` to `ChatMessageView`.
- Render two icon buttons in a `.message-actions` container when `content.trim()` is non-empty.
- In `App`, pass an async callback that formats content, calls `writeToClipboard`, and shows `Message copied as markdown` or `Message copied as plaintext`.
- Keep failure handling local with `Failed to copy message`.

- [ ] **Step 4: Run integration tests to verify GREEN**

Run: `npm --workspace agent-browser run test -- src/App.test.tsx -t "copies .* message as"`

Expected: PASS.

### Task 3: Verification and Visual Review

**Files:**
- Verify existing scripts only.

- [ ] **Step 1: Run targeted tests**

Run: `npm --workspace agent-browser run test -- src/services/chatMessageCopy.test.ts src/App.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run full required verification**

Run: `npm run verify:agent-browser`

Expected: PASS lint, coverage tests, build, audit, and visual smoke.

- [ ] **Step 3: Run repeatable visual smoke**

Run: `npm run visual:agent-browser`

Expected: PASS and screenshot written to `output/playwright/agent-browser-visual-smoke.png`.

- [ ] **Step 4: Visual design review**

Inspect the screenshot and verify:
- message copy buttons are compact and aligned with sender labels,
- controls do not overlap message bubbles,
- chat transcript remains readable at the smoke viewport,
- no large color or spacing regressions were introduced.
