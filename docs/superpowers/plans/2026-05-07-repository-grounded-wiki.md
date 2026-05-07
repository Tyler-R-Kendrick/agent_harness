# Repository-Grounded Wiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a durable Agent Browser wiki panel that turns active workspace files and workspace structure into refreshable repo maps, architecture views, onboarding guidance, and citation snippets.

**Architecture:** Add a pure `repoWiki` service that derives a deterministic wiki snapshot from `TreeNode`, `WorkspaceFile[]`, and discovered workspace capabilities. Wire the snapshot through `AgentBrowserApp` into a new first-class `Wiki` sidebar panel, persist refreshed snapshots in local storage, and include concise wiki context in agent prompts.

**Tech Stack:** React 18, TypeScript, Vitest, localStorage-backed Agent Browser session state, existing workspace tree/file services, Playwright visual smoke.

---

## Feature Implementation Plan

TK-48 asks for a standing repository wiki rather than a one-off report. The first useful vertical slice is a local, deterministic wiki snapshot that works with the Agent Browser workspace model today:

- A new `Wiki` activity-bar panel shows the active workspace name, last refresh time, repo map cards, architecture diagram rows, onboarding guidance, durable artifact/citation IDs, and source file coverage.
- A `Refresh wiki` action regenerates the wiki from active workspace files, browser/session/file tree nodes, and discovered workspace capabilities.
- The snapshot is persisted per workspace under a dedicated localStorage key so it survives refresh and can be reused across sessions.
- Agent prompt context includes a compact wiki summary and citation IDs so planning, implementation, and review turns can cite stable wiki views.
- Visual smoke coverage opens the Wiki panel and captures screenshot evidence.

## Technical Spec

### Data Model

`agent-browser/src/services/repoWiki.ts` owns the domain model:

- `RepoWikiSnapshot`: `{ id, workspaceId, workspaceName, refreshedAt, summary, sourceCoverage, sections, diagrams, onboarding, citations }`
- `RepoWikiSection`: repo-map cards for workspace tree, capability files, plugins/hooks, sessions/browser pages, and generated artifacts.
- `RepoWikiDiagram`: architecture rows expressed as named nodes and directional edges, rendered accessibly in the UI.
- `RepoWikiCitation`: stable citation handles such as `wiki:research:capabilities` with labels, source paths, and snippet text.

The builder is deterministic, total, and browser-safe. It does not read the host filesystem directly; it scans the active Agent Browser workspace state already available in memory and browser storage.

### UI Integration

`App.tsx` adds `wiki` to `SidebarPanel`, `PRIMARY_NAV`, `PANEL_SHORTCUT_ORDER`, `SIDEBAR_PANEL_META`, and `VALID_SIDEBAR_PANELS`. `RepoWikiPanel` renders inside `renderSidebar()` and receives:

- `snapshot`
- `workspaceName`
- `onRefresh`
- `onCopyCitation`

The panel uses existing dense sidebar visual language: restrained cards, compact headings, icon buttons, accessible labels, and mobile-friendly wrapping.

### Persistence

`sessionState.ts` adds `repoWikiSnapshotsByWorkspace: 'agent-browser.repo-wiki-snapshots-by-workspace'`.

`AgentBrowserApp` stores `Record<string, RepoWikiSnapshot>` through `useStoredState`. If no snapshot exists for the active workspace, the app derives one in memory. Pressing refresh persists the new snapshot and shows a toast.

### Agent Context

`ChatPanel` receives `repoWikiPromptContext` and appends it to `workspacePromptContext`. The context includes the summary, source coverage, top section labels, diagram titles, and citation IDs without dumping full UI content into every turn.

### Tests and Verification

- Unit tests cover section generation, source coverage, architecture edge generation, citation stability, prompt-context formatting, and validator behavior.
- App smoke tests assert the Wiki activity button and panel render the expected repo map, architecture views, citation IDs, and refresh button.
- Script smoke tests assert `visual-smoke.mjs` verifies the Wiki panel.
- Full gate remains `npm.cmd run verify:agent-browser`; if the Windows sandbox blocks Vite/esbuild spawn, record exact blockers and run targeted deterministic checks.

## One-Shot LLM Prompt

You are implementing Linear TK-48 in `agent-browser` of the `agent-harness` repo.

Build a repository-grounded wiki system for Agent Browser. Add a deterministic `repoWiki` service that scans the active workspace tree, workspace files, discovered capabilities, artifacts, and browser/session nodes to produce a durable `RepoWikiSnapshot` containing repo-map sections, architecture diagram rows, onboarding guidance, and stable citation handles. Persist snapshots per workspace in `sessionState.ts`, expose a first-class `Wiki` sidebar panel in `App.tsx`, and append a compact wiki summary to agent workspace prompt context. Use the existing Agent Browser sidebar/card visual language and keep the feature browser-local; do not add a backend or host filesystem dependency.

Implement with TDD:

1. Write failing `repoWiki.test.ts` coverage for deterministic snapshot generation, source coverage, citations, diagram edges, prompt context, and validation.
2. Write failing App smoke coverage for the Wiki activity panel.
3. Implement the service and persistence key.
4. Wire the app state, panel navigation, prompt context, refresh action, and copy citation behavior.
5. Add visual-smoke assertions and screenshot capture for the Wiki panel.
6. Run focused tests, `npm.cmd --workspace agent-browser run test:scripts`, `npm.cmd --workspace agent-browser run lint`, `npm.cmd run visual:agent-browser`, and `npm.cmd run verify:agent-browser`.

## Task Plan

### Task 1: Repo Wiki Service

**Files:**
- Create: `agent-browser/src/services/repoWiki.ts`
- Create: `agent-browser/src/services/repoWiki.test.ts`

- [ ] **Step 1: Write failing service tests**

```ts
import { describe, expect, test } from 'vitest';
import { buildRepoWikiSnapshot, buildRepoWikiPromptContext, isRepoWikiSnapshotsByWorkspace } from './repoWiki';
import type { TreeNode, WorkspaceFile } from '../types';

const workspace: TreeNode = {
  id: 'ws-research',
  name: 'Research',
  type: 'workspace',
  children: [
    { id: 'browser', name: 'Browser', type: 'folder', nodeKind: 'browser', children: [{ id: 'tab-1', name: 'Docs', type: 'tab', nodeKind: 'browser', url: 'https://example.test' }] },
    { id: 'sessions', name: 'Sessions', type: 'folder', nodeKind: 'session', children: [{ id: 'session-1', name: 'Planning', type: 'tab', nodeKind: 'session' }] },
  ],
};

const files: WorkspaceFile[] = [
  { path: '.memory/project.memory.md', content: '# Project memory\n- Durable orientation', updatedAt: '2026-05-07T00:00:00.000Z' },
  { path: '.agents/plugins/review/agent-harness.plugin.json', content: '{"name":"Review plugin","capabilities":[]}', updatedAt: '2026-05-07T00:00:00.000Z' },
  { path: 'settings.json', content: '{"model":"codi"}', updatedAt: '2026-05-07T00:00:00.000Z' },
];

test('builds a durable workspace wiki snapshot with repo map sections and citations', () => {
  const snapshot = buildRepoWikiSnapshot({ workspace, files, refreshedAt: '2026-05-07T00:00:00.000Z' });
  expect(snapshot.workspaceId).toBe('ws-research');
  expect(snapshot.sections.map((section) => section.id)).toEqual(['workspace-map', 'capability-files', 'runtime-surfaces']);
  expect(snapshot.citations.map((citation) => citation.id)).toContain('wiki:ws-research:capability-files');
});
```

- [ ] **Step 2: Run red test**

Run: `npm.cmd --workspace agent-browser run test -- src/services/repoWiki.test.ts`

Expected: FAIL because `repoWiki.ts` does not exist.

- [ ] **Step 3: Implement minimal service**

Create total functions for snapshot generation, prompt-context formatting, and snapshot record validation.

- [ ] **Step 4: Run green test**

Run: `npm.cmd --workspace agent-browser run test -- src/services/repoWiki.test.ts`

Expected: PASS.

### Task 2: App Wiring and Wiki Panel

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/App.smoke.test.tsx`

- [ ] **Step 1: Write failing App smoke assertions**

Assert that the Wiki activity button opens a `Repository wiki` region with `Repo map`, `Architecture views`, `Onboarding`, `wiki:ws-research:workspace-map`, and `Refresh wiki`.

- [ ] **Step 2: Run red smoke test**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx`

Expected: FAIL because the Wiki panel is not wired.

- [ ] **Step 3: Implement panel and persistence**

Add the `wiki` panel, persisted snapshot map, `RepoWikiPanel`, refresh/copy handlers, and prompt context injection.

- [ ] **Step 4: Run green smoke test**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx`

Expected: PASS.

### Task 3: Visual Smoke and Closeout

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Modify: `agent-browser/scripts/run-script-tests.mjs`
- Add after verification: `docs/superpowers/plans/2026-05-07-repository-grounded-wiki-visual-smoke.png`

- [ ] **Step 1: Add visual-smoke assertions**

Open Wiki, assert the region and key labels, capture `output/playwright/agent-browser-repository-wiki.png`.

- [ ] **Step 2: Run script tests**

Run: `npm.cmd --workspace agent-browser run test:scripts`

Expected: PASS.

- [ ] **Step 3: Run visual smoke**

Run: `npm.cmd run visual:agent-browser`

Expected: PASS and screenshots written under `output/playwright/`.

- [ ] **Step 4: Run full verification**

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`

Expected: PASS.

- [ ] **Step 5: Publish**

Create branch `codex/tk-48-repository-grounded-wiki`, commit, push, open PR, add `codex` and `codex-automation` labels, include screenshot evidence, link PR to Linear TK-48, and move the issue to Done after green checks.

## Self-Review

- Spec coverage: The plan covers durable wiki generation, refresh, architecture diagrams, citations, UI surface, prompt context, tests, visual smoke, PR, and Linear closeout.
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: `RepoWikiSnapshot`, `RepoWikiSection`, `RepoWikiDiagram`, and `RepoWikiCitation` names are used consistently across service, UI, tests, and prompt context.
