# Persistent Memory Graphs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-local persistent GraphRAG/PathRAG memory surface in Agent Browser that ingests text, stores a typed graph, retrieves prompt-ready context, explains ranked paths, visualizes the retrieved subgraph, and imports/exports memory without a backend.

**Architecture:** Add a deterministic graph-memory service as the tested core, wrap it with a worker-shaped client boundary for UI use, and expose it through the existing Agent Browser Settings surface first. The initial engine is a worker-owned local property graph with a Kuzu-WASM-compatible adapter seam; it keeps all ingestion, retrieval, query, path, and context work off React render code and can swap to the `kuzu-wasm` package once dependency installation is available.

**Tech Stack:** TypeScript, React, Vite, Vitest, Web Worker protocol types, localStorage/IndexedDB-compatible JSON persistence, existing Agent Browser Settings/visual-smoke infrastructure.

---

## Feature Implementation Plan

TK-29 asks for a static browser app that runs offline after first load, stores persistent graph memory locally, retrieves relevant memory from natural-language questions, displays PathRAG explanations, supports advanced graph-like queries, and avoids backend services, Neo4j, Python, hosted graph databases, and network calls after load.

The Agent Browser-aligned implementation will add this as an inspectable local memory subsystem inside the current app instead of starting a separate app shell. It will:

- Create a typed graph memory service with `Document`, `Chunk`, `Entity`, `Claim`, `Topic`, `Memory`, and relationship records.
- Implement deterministic local chunking, entity/topic/claim extraction, lexical scoring, neighborhood expansion, ranked path selection, context block generation, direct query handling, sample data, import/export, and reset.
- Provide a worker/client protocol so UI code talks to a single async graph boundary.
- Persist the graph in the existing browser storage style for refresh survival and offline operation.
- Expose a “Persistent memory graphs” Settings section with status, stats, sample load, ingest, search, path explorer, graph view, query editor, import/export, and reset controls.
- Extend App smoke and visual-smoke checks so the feature remains visible, accessible, and screenshot-backed.

## Architecture-Aligned Technical Spec

### Core Service

`agent-browser/src/services/persistentMemoryGraph.ts` owns the domain model and pure logic.

Required exported API:

```ts
export const EMPTY_PERSISTENT_MEMORY_GRAPH: PersistentMemoryGraphState;
export const SAMPLE_MEMORY_TEXT: string;
export function isPersistentMemoryGraphState(value: unknown): value is PersistentMemoryGraphState;
export function createPersistentMemoryGraphState(now?: string): PersistentMemoryGraphState;
export function loadSampleMemoryGraph(now?: string): PersistentMemoryGraphState;
export function ingestTextToMemoryGraph(state: PersistentMemoryGraphState, input: MemoryGraphIngestInput): PersistentMemoryGraphState;
export function searchPersistentMemoryGraph(state: PersistentMemoryGraphState, question: string, options?: MemoryGraphRetrievalOptions): MemoryGraphRetrievalResult;
export function retrievePathsForQuestion(state: PersistentMemoryGraphState, question: string, options?: MemoryGraphRetrievalOptions): MemoryGraphPath[];
export function buildRagContext(result: MemoryGraphRetrievalResult): string;
export function runMemoryGraphQuery(state: PersistentMemoryGraphState, query: string): MemoryGraphQueryResult;
export function exportPersistentMemoryGraph(state: PersistentMemoryGraphState): string;
export function importPersistentMemoryGraph(serialized: string): PersistentMemoryGraphState;
```

The first implementation is deterministic and local. It does not call an LLM, embedding API, backend API, Neo4j, or Python. A future Kuzu adapter can preserve the exported domain contract while replacing the storage/query engine.

### Worker Boundary

`agent-browser/src/services/persistentMemoryGraphWorker.ts` defines a message handler that can run in a Web Worker or in tests:

```ts
export type PersistentMemoryGraphWorkerRequest =
  | { id: string; type: 'init' }
  | { id: string; type: 'loadSampleMemory' }
  | { id: string; type: 'ingestText'; input: MemoryGraphIngestInput }
  | { id: string; type: 'searchMemory'; question: string; options?: MemoryGraphRetrievalOptions }
  | { id: string; type: 'runQuery'; query: string }
  | { id: string; type: 'exportMemory' }
  | { id: string; type: 'importMemory'; serialized: string }
  | { id: string; type: 'resetDatabase' };
```

The handler returns typed responses and keeps state changes centralized. `agent-browser/src/services/persistentMemoryGraphClient.ts` provides a small async client wrapper used by React and unit tests. The first client can use the in-process handler as a no-spawn fallback in test and sandbox environments, while preserving the worker protocol.

### UI

`agent-browser/src/App.tsx` adds a `PersistentMemoryGraphSettingsPanel` near other Settings control-plane sections. The section must be mobile-first and accessible:

- Toggle/status card: `WASM-compatible local graph`, `worker boundary`, `offline-ready`, node/edge counts.
- Buttons: `Load sample memory`, `Ingest Text`, `Search Memory`, `Run Query`, `Export Memory`, `Import Memory`, `Reset Memory`.
- Inputs: document title/source, text area, natural-language question, graph query editor, import JSON.
- Result tabs are represented as labeled subsections: Context, Evidence, Paths, Graph, Table, Raw JSON.
- Graph visualization is an SVG/list hybrid using existing app CSS, not a new dependency.
- Errors and empty states are visible text with `role="status"` or `role="alert"` where appropriate.

### Persistence

Add `persistentMemoryGraphState` to `STORAGE_KEYS` in `agent-browser/src/services/sessionState.ts` and hydrate it through `useStoredState` in `App.tsx`.

The graph state must survive refresh via local storage and support JSON import/export. The design remains compatible with IndexedDB/OPFS because all graph state is serialized behind the worker/client protocol.

### Visual Validation

`agent-browser/scripts/visual-smoke.mjs` opens Settings, expands `Persistent memory graphs`, verifies the controls and sample retrieval output, checks mobile/tablet/desktop/wide layout does not overflow, and captures:

`docs/superpowers/plans/2026-05-08-persistent-memory-graphs-visual-smoke.png`

## One-Shot LLM Prompt

Implement Linear TK-29 in `agent-browser` using strict TDD. Start with failing Vitest coverage for `agent-browser/src/services/persistentMemoryGraph.ts`, then implement the pure graph-memory service. Add a typed worker message handler and client wrapper. Add `STORAGE_KEYS.persistentMemoryGraphState`, hydrate the feature in `App.tsx`, and render a Settings section named `Persistent memory graphs` with local graph status, sample loading, ingestion, natural-language search, PathRAG explanations, context block, graph visualization, direct query results, JSON import/export, and reset. Do not add backend APIs, Python, Neo4j, hosted graph dependencies, or network embedding calls. Preserve a Kuzu-WASM adapter seam but keep the initial implementation deterministic and offline with no new dependency required. Add App smoke coverage and visual-smoke assertions. Run focused tests first, then `npm.cmd run verify:agent-browser`, and attach the generated screenshot to the PR.

## TDD Plan

### Task 1: Persistent Graph Service

**Files:**
- Create: `agent-browser/src/services/persistentMemoryGraph.ts`
- Create: `agent-browser/src/services/persistentMemoryGraph.test.ts`

- [ ] **Step 1: Write the failing service test**

```ts
it('ingests text into a typed graph and retrieves prompt-ready path context', () => {
  const state = ingestTextToMemoryGraph(createPersistentMemoryGraphState('2026-05-08T00:00:00.000Z'), {
    title: 'Retrieval design notes',
    source: 'sample',
    text: 'Azure AI Search improves retrieval. Kuzu-WASM enables offline graph traversal. GraphRAG connects evidence to claims.',
    now: '2026-05-08T00:00:00.000Z',
  });
  const result = searchPersistentMemoryGraph(state, 'How does Kuzu-WASM help retrieval?', { maxPaths: 3 });
  expect(state.documents).toHaveLength(1);
  expect(state.chunks.length).toBeGreaterThan(0);
  expect(state.entities.map((entity) => entity.name)).toContain('Kuzu-WASM');
  expect(result.contextBlock).toContain('MEMORY SUMMARY');
  expect(result.contextBlock).toContain('Kuzu-WASM');
  expect(result.paths[0]?.explanation).toMatch(/matched/i);
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm.cmd --workspace agent-browser run test -- persistentMemoryGraph.test.ts`

Expected: FAIL because `./persistentMemoryGraph` does not exist.

- [ ] **Step 3: Implement the minimal service**

Implement stable IDs, chunking, extraction, relationships, retrieval scoring, path ranking, context block generation, query handling, import/export validation, and state guards.

- [ ] **Step 4: Verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- persistentMemoryGraph.test.ts`

Expected: PASS with 100% coverage for the new service file when included in the package coverage run.

### Task 2: Worker and Client Boundary

**Files:**
- Create: `agent-browser/src/services/persistentMemoryGraphWorker.ts`
- Create: `agent-browser/src/services/persistentMemoryGraphClient.ts`
- Create: `agent-browser/src/services/persistentMemoryGraphWorker.test.ts`

- [ ] **Step 1: Write failing worker/client tests**

```ts
it('handles init, sample load, search, export, import, and reset through typed requests', async () => {
  const client = createPersistentMemoryGraphClient();
  await client.loadSampleMemory();
  const search = await client.searchMemory('offline graph retrieval');
  expect(search.contextBlock).toContain('MEMORY SUMMARY');
  const exported = await client.exportMemory();
  await client.resetDatabase();
  await client.importMemory(exported);
  expect((await client.searchMemory('Kuzu-WASM')).entities.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run RED**

Run: `npm.cmd --workspace agent-browser run test -- persistentMemoryGraphWorker.test.ts`

Expected: FAIL because the worker/client modules do not exist.

- [ ] **Step 3: Implement worker/client**

The client uses the typed handler directly by default and exposes async methods shaped like a Worker RPC client. The message handler owns mutable graph state and returns typed success/error responses.

- [ ] **Step 4: Verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- persistentMemoryGraphWorker.test.ts`

Expected: PASS.

### Task 3: App State and Settings UI

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/src/App.smoke.test.tsx`

- [ ] **Step 1: Write failing App smoke test**

```ts
it('renders persistent memory graph controls in Settings and searches sample memory', async () => {
  vi.useFakeTimers();
  render(<App />);
  await act(async () => { vi.advanceTimersByTime(350); });
  fireEvent.click(screen.getByLabelText('Settings'));
  fireEvent.click(screen.getByRole('button', { name: 'Persistent memory graphs' }));
  fireEvent.click(screen.getByRole('button', { name: 'Load sample memory' }));
  fireEvent.change(screen.getByLabelText('Memory graph question'), { target: { value: 'How does Kuzu-WASM support offline retrieval?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search Memory' }));
  expect(screen.getByText('WASM-compatible local graph')).toBeInTheDocument();
  expect(screen.getByText(/MEMORY SUMMARY/)).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Retrieved memory graph' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run RED**

Run: `npm.cmd --workspace agent-browser run test:app -- App.smoke.test.tsx`

Expected: FAIL because the Settings section does not exist.

- [ ] **Step 3: Implement UI**

Add state hydration, a compact Settings panel, accessible controls, graph SVG/list rendering, import/export/reset actions, and scoped CSS. Keep layout responsive with no nested cards and no oversized hero treatment.

- [ ] **Step 4: Verify GREEN**

Run: `npm.cmd --workspace agent-browser run test:app -- App.smoke.test.tsx`

Expected: PASS.

### Task 4: Visual Smoke and Full Verification

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Add generated evidence after the command succeeds: `docs/superpowers/plans/2026-05-08-persistent-memory-graphs-visual-smoke.png`

- [ ] **Step 1: Add visual-smoke assertions**

Open Settings, expand `Persistent memory graphs`, load sample memory, search for `Kuzu-WASM offline retrieval`, assert context/path/graph output, and screenshot the section.

- [ ] **Step 2: Run visual and full verification**

Run:

```powershell
npm.cmd run visual:agent-browser
NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser
```

Expected: visual screenshot is written, and the full Agent Browser verifier passes. If the Windows sandbox blocks esbuild, Playwright, Git, or network operations, capture exact blocker strings in Linear and automation memory.

### Task 5: Publish and Complete Linear

**Files:**
- All changed files from tasks 1-4

- [ ] **Step 1: Commit and push**

Run:

```powershell
.\scripts\codex-git.ps1 switch -c codex/tk-29-persistent-memory-graphs
.\scripts\codex-git.ps1 add agent-browser docs/superpowers/plans
.\scripts\codex-git.ps1 commit -m "feat: add persistent memory graphs"
.\scripts\codex-git.ps1 push -u origin codex/tk-29-persistent-memory-graphs
```

- [ ] **Step 2: Open PR with screenshot evidence**

Use `scripts/codex-gh.ps1` when available. Add `codex` and `codex-automation` labels. Include the visual-smoke screenshot path and verification commands in the PR body.

- [ ] **Step 3: Complete Linear**

Link the PR to TK-29, comment with verification and merge status, and move TK-29 to Done only after implementation and PR publication are complete.

## Self-Review

- Spec coverage: ingestion, deterministic extraction, local retrieval, PathRAG paths, context block, query editor, visualization, import/export, persistence, worker boundary, offline PWA compatibility, tests, visual proof, and PR/Linear lifecycle all map to tasks.
- Placeholder scan: no TBD/TODO/fill-in markers remain.
- Type consistency: `PersistentMemoryGraphState`, `MemoryGraphRetrievalResult`, `retrievePathsForQuestion`, and `buildRagContext` are used consistently across service, worker/client, UI, and tests.
