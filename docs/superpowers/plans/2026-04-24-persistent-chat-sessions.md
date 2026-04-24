# Persistent Chat Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist agent-browser chat sessions and transcripts across browser restarts, and purge persisted transcript state when a session is deleted.

**Architecture:** Use the existing `useStoredState` storage abstraction so durable session data follows the same hydration/debounce path as installed local models. Persist the workspace/session tree and workspace view state in `localStorage` because chat transcripts are keyed by session ids. Persist chat transcripts and chat input history by session id, and add a small storage helper to remove deleted session entries from persisted record-shaped state.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, jsdom, browser `localStorage`.

---

## Feature Implementation Plan

Linear issue TK-10 says: "Sessions are supposed to be session based, preserving history. When you delete a session, its removed from memory. Chats should persist beyond browser sessions."

Implementation scope:
- Durable across browser sessions: workspace/session tree, workspace view state, chat messages by session, chat input history by session.
- Per-tab only: selected provider/model state remains in `sessionStorage`; this keeps existing ephemeral model selection behavior unchanged.
- Deletion cleanup: when a session tree node is removed, delete its persisted chat transcript and input history entries.
- Validation: corrupted or invalid storage payloads fall back to defaults and must not crash app mount.

## Technical Spec

### Storage Keys

Add these durable keys in `agent-browser/src/services/sessionState.ts`:

```ts
workspaceRoot: 'agent-browser.workspace-root',
workspaceViewStateByWorkspace: 'agent-browser.workspace-view-state-by-workspace',
chatMessagesBySession: 'agent-browser.chat-messages-by-session',
chatHistoryBySession: 'agent-browser.chat-history-by-session',
```

### Validators

Add validators in `agent-browser/src/services/sessionState.ts`:

```ts
isTreeNode(value: unknown): value is TreeNode
isWorkspaceViewStateRecord(value: unknown): value is Record<string, WorkspaceViewState>
isChatMessagesBySession(value: unknown): value is Record<string, ChatMessage[]>
isStringArrayRecord(value: unknown): value is Record<string, string[]>
```

Each validator accepts only serializable object shapes that the app already renders:
- `TreeNode` requires string `id`, string `name`, valid `type`, and recursively valid optional `children`.
- `WorkspaceViewState` requires string arrays for `openTabIds`, `activeSessionIds`, `mountedSessionFsIds`, and `panelOrder`, `editingFilePath` as string or null, and `activeMode` as `agent` or `terminal`.
- `ChatMessage` requires string `id`, valid `role`, and string `content`; optional fields may be present, but known primitive fields are validated when present.
- String array records require object values whose entries are string arrays.

### Cleanup Helper

Add this helper in `agent-browser/src/services/sessionState.ts`:

```ts
export function removeStoredRecordEntry<T extends Record<string, unknown>>(
  backend: StorageBackend | null | undefined,
  key: string,
  validate: Validator<T>,
  entryId: string,
  onError?: SaveErrorHandler,
): void
```

Behavior:
- If `backend` is missing, return.
- Load the JSON value with `loadJson`.
- If the loaded record has no `entryId`, return without writing.
- Delete the entry and save the next record with `saveJson`.

### App Integration

Modify `agent-browser/src/App.tsx`:
- Import the new validators and cleanup helper from `./services/sessionState`.
- Replace `useState<TreeNode>` for `root` with `useStoredState<TreeNode>(localStorageBackend, STORAGE_KEYS.workspaceRoot, isTreeNode, initialRootRef.current)`.
- Replace `useState<Record<string, WorkspaceViewState>>` for `workspaceViewStateByWorkspace` with `useStoredState<Record<string, WorkspaceViewState>>(localStorageBackend, STORAGE_KEYS.workspaceViewStateByWorkspace, isWorkspaceViewStateRecord, createWorkspaceViewState(root))`.
- Replace `useState<Record<string, ChatMessage[]>>({})` in `ChatPanel` with durable `useStoredState` using `STORAGE_KEYS.chatMessagesBySession` and `isChatMessagesBySession`.
- Replace `useState<Record<string, string[]>>({})` in `ChatPanel` with durable `useStoredState` using `STORAGE_KEYS.chatHistoryBySession` and `isStringArrayRecord`.
- In `handleRemoveFileNode`, when `node.nodeKind === 'session'`, call `removeStoredRecordEntry` for `chatMessagesBySession` and `chatHistoryBySession` using `localStorageBackend`.

## One-Shot LLM Prompt

```text
You are editing C:\Users\conta\.codex\worktrees\7764\agent-harness. Implement Linear issue TK-10, "Persistent chat sessions", for the agent-browser package.

Follow TDD. First add failing Vitest coverage in agent-browser/src/services/sessionState.test.ts and agent-browser/src/App.persistence.test.tsx showing:
1. App hydrates a persisted workspace/session tree, workspace view state, and chat transcript from localStorage, rendering the persisted session name and message after mount.
2. removeStoredRecordEntry deletes a session id from a stored record and leaves missing entries untouched.

Then implement the minimum production code:
- Add durable STORAGE_KEYS for workspaceRoot, workspaceViewStateByWorkspace, chatMessagesBySession, and chatHistoryBySession.
- Add validators isTreeNode, isWorkspaceViewStateRecord, isChatMessagesBySession, and isStringArrayRecord in sessionState.ts.
- Add removeStoredRecordEntry in sessionState.ts.
- Use useStoredState with localStorage for AgentBrowserApp root and workspaceViewStateByWorkspace.
- Use useStoredState with localStorage for ChatPanel messagesBySession and chatHistoryBySession.
- When deleting a session node in handleRemoveFileNode, purge that session id from persisted chatMessagesBySession and chatHistoryBySession.

Do not convert selected provider/model state from sessionStorage to localStorage. Do not add new dependencies. Keep validation total and fallback-safe. Run the targeted tests, coverage, and finally npm run verify:agent-browser from the repo root.
```

## File Structure

- Modify: `agent-browser/src/services/sessionState.ts`
  - Owns storage keys, JSON load/save, stored-state hook, validators, and record-entry deletion helper.
- Modify: `agent-browser/src/services/sessionState.test.ts`
  - Unit coverage for new keys, validators, and record-entry deletion helper.
- Modify: `agent-browser/src/App.persistence.test.tsx`
  - Regression coverage for durable workspace/session/chat hydration.
- Modify: `agent-browser/src/App.tsx`
  - Wire durable storage into app state and session deletion cleanup.

### Task 1: Storage Helper and Validator Tests

**Files:**
- Modify: `agent-browser/src/services/sessionState.test.ts`
- Modify after red: `agent-browser/src/services/sessionState.ts`

- [x] **Step 1: Write the failing tests**

Add these imports:

```ts
import {
  STORAGE_KEYS,
  isChatMessagesBySession,
  isStringArrayRecord,
  isTreeNode,
  isWorkspaceViewStateRecord,
  loadJson,
  removeStoredRecordEntry,
  saveJson,
  useStoredState,
} from './sessionState';
```

Add these assertions to the `STORAGE_KEYS` category test:

```ts
workspaceRoot: expect.any(String),
workspaceViewStateByWorkspace: expect.any(String),
chatMessagesBySession: expect.any(String),
chatHistoryBySession: expect.any(String),
```

Add tests:

```ts
describe('persistent session validators', () => {
  it('accepts valid workspace trees and rejects invalid tree nodes', () => {
    expect(isTreeNode({
      id: 'root',
      name: 'Root',
      type: 'root',
      expanded: true,
      children: [{ id: 'session-1', name: 'Session 1', type: 'tab', nodeKind: 'session' }],
    })).toBe(true);
    expect(isTreeNode({ id: 'root', name: 'Root', type: 'invalid' })).toBe(false);
  });

  it('accepts valid workspace view state records and rejects bad active modes', () => {
    expect(isWorkspaceViewStateRecord({
      'ws-research': {
        openTabIds: [],
        editingFilePath: null,
        activeMode: 'agent',
        activeSessionIds: ['session-1'],
        mountedSessionFsIds: ['session-1'],
        panelOrder: ['session:session-1'],
      },
    })).toBe(true);
    expect(isWorkspaceViewStateRecord({
      'ws-research': {
        openTabIds: [],
        editingFilePath: null,
        activeMode: 'browser',
        activeSessionIds: [],
        mountedSessionFsIds: [],
        panelOrder: [],
      },
    })).toBe(false);
  });

  it('accepts persisted chat transcripts and chat history records', () => {
    expect(isChatMessagesBySession({
      'session-1': [
        { id: 'session-1:system', role: 'system', content: 'Ready' },
        { id: 'message-1', role: 'user', content: 'Hello' },
      ],
    })).toBe(true);
    expect(isChatMessagesBySession({ 'session-1': [{ id: 'bad', role: 'bogus', content: 'Nope' }] })).toBe(false);
    expect(isStringArrayRecord({ 'session-1': ['Hello', 'Again'] })).toBe(true);
    expect(isStringArrayRecord({ 'session-1': ['Hello', 42] })).toBe(false);
  });
});

describe('removeStoredRecordEntry', () => {
  it('removes one entry from a valid stored record', () => {
    window.localStorage.setItem('record', JSON.stringify({ keep: ['a'], remove: ['b'] }));
    removeStoredRecordEntry(window.localStorage, 'record', isStringArrayRecord, 'remove');
    expect(JSON.parse(window.localStorage.getItem('record') ?? '{}')).toEqual({ keep: ['a'] });
  });

  it('does not rewrite storage when the entry is absent', () => {
    window.localStorage.setItem('record', JSON.stringify({ keep: ['a'] }));
    const setItem = vi.spyOn(window.localStorage.__proto__, 'setItem');
    removeStoredRecordEntry(window.localStorage, 'record', isStringArrayRecord, 'missing');
    expect(setItem).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm --workspace agent-browser run test -- agent-browser/src/services/sessionState.test.ts`

Expected: FAIL because the new exports and storage keys do not exist.

- [x] **Step 3: Implement minimal storage code**

Add imports and the validator/helper implementations described in the technical spec to `agent-browser/src/services/sessionState.ts`.

- [x] **Step 4: Run test to verify it passes**

Run: `npm --workspace agent-browser run test -- agent-browser/src/services/sessionState.test.ts`

Expected: PASS.

### Task 2: Durable App Hydration Test

**Files:**
- Modify: `agent-browser/src/App.persistence.test.tsx`
- Modify after red: `agent-browser/src/App.tsx`

- [x] **Step 1: Write the failing test**

Add a helper in `App.persistence.test.tsx`:

```ts
const seedPersistedChatSession = () => {
  window.localStorage.setItem(STORAGE_KEYS.workspaceRoot, JSON.stringify({
    id: 'root',
    name: 'Root',
    type: 'root',
    expanded: true,
    children: [{
      id: 'ws-research',
      name: 'Research',
      type: 'workspace',
      expanded: true,
      activeMemory: true,
      color: '#60a5fa',
      children: [{
        id: 'ws-research:category:session',
        name: 'Sessions',
        type: 'folder',
        nodeKind: 'session',
        expanded: true,
        children: [{
          id: 'session-persisted',
          name: 'Restored Session',
          type: 'tab',
          nodeKind: 'session',
          persisted: true,
          filePath: 'ws-research:session:restored',
        }],
      }],
    }],
  }));
  window.localStorage.setItem(STORAGE_KEYS.workspaceViewStateByWorkspace, JSON.stringify({
    'ws-research': {
      openTabIds: [],
      editingFilePath: null,
      activeMode: 'agent',
      activeSessionIds: ['session-persisted'],
      mountedSessionFsIds: ['session-persisted'],
      panelOrder: ['session:session-persisted'],
    },
  }));
  window.localStorage.setItem(STORAGE_KEYS.chatMessagesBySession, JSON.stringify({
    'session-persisted': [
      { id: 'session-persisted:system', role: 'system', content: 'Ready from storage.' },
      { id: 'message-persisted', role: 'user', content: 'Persisted hello from storage.' },
    ],
  }));
};
```

Add a test:

```ts
it('hydrates persisted chat sessions and transcripts from localStorage on mount', async () => {
  vi.useFakeTimers();
  seedPersistedChatSession();

  render(<App />);
  await act(async () => { vi.advanceTimersByTime(350); });

  expect(screen.getAllByText(/Restored Session/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/Persisted hello from storage/i)).toBeInTheDocument();
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm --workspace agent-browser run test -- agent-browser/src/App.persistence.test.tsx`

Expected: FAIL because App still initializes root and chat messages from `useState`.

- [x] **Step 3: Implement minimal App wiring**

In `App.tsx`, import:

```ts
import {
  STORAGE_KEYS,
  isChatMessagesBySession,
  isString,
  isStringArrayRecord,
  isStringRecord,
  isTreeNode,
  isWorkspaceViewStateRecord,
  removeStoredRecordEntry,
  useStoredState,
} from './services/sessionState';
```

Change root, workspace view state, chat message, and chat history state as described in the technical spec. In session deletion, add:

```ts
removeStoredRecordEntry(localStorageBackend, STORAGE_KEYS.chatMessagesBySession, isChatMessagesBySession, nodeId);
removeStoredRecordEntry(localStorageBackend, STORAGE_KEYS.chatHistoryBySession, isStringArrayRecord, nodeId);
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm --workspace agent-browser run test -- agent-browser/src/App.persistence.test.tsx`

Expected: PASS.

### Task 3: Verification, Visual Review, and PR

**Files:**
- Read generated screenshot: `output/playwright/agent-browser-visual-smoke.png`
- Update Linear issue: TK-10

- [x] **Step 1: Run coverage metrics**

Run: `npm --workspace agent-browser run test:coverage -- agent-browser/src/services/sessionState.test.ts agent-browser/src/App.persistence.test.tsx`

Expected: PASS and coverage output printed for changed files.

- [x] **Step 2: Run full agent-browser verification**

Run: `npm run verify:agent-browser`

Expected: PASS. This includes lint, tests, build, audit, and `npm run visual:agent-browser`.

- [x] **Step 3: Review visual output**

Open `output/playwright/agent-browser-visual-smoke.png` and confirm there are no new overlaps, clipping, blank panes, or broken shell layout. This feature should not introduce intentional visual changes.

- [ ] **Step 4: Update Linear and open PR**

Post a Linear comment summarizing the implementation and verification. Move TK-10 to Done only after the PR exists. Create a branch, commit, push, and open a PR with the visual smoke screenshot path mentioned in the body. Add labels `codex` and `codex-automation` when available.

## Self-Review

- Spec coverage: Durable chat sessions are covered by Task 2. Stable session ids across browser restarts are covered by persisting `workspaceRoot`. Workspace pane restoration is covered by persisting `workspaceViewStateByWorkspace`. Deletion cleanup is covered by Task 1 helper and Task 2 app wiring.
- Placeholder scan: This plan contains no placeholder implementation steps.
- Type consistency: Storage key names, validator names, and helper signatures match the technical spec and task code snippets.
