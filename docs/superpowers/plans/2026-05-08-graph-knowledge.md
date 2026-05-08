# Graph Knowledge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browser-local GraphRAG / PathRAG / tiered agent-memory workbench to Agent Browser that can ingest sample knowledge, retrieve graph-backed context, and generate prompt-ready context packs offline.

**Architecture:** Keep the first implementation slice inside Agent Browser's existing Settings and persistence model. Implement deterministic graph-memory behavior in pure TypeScript, define a typed worker message contract for future WASM/Kuzu ownership, persist state with `sessionState.ts`, and expose the feature through a compact Settings workbench with smoke and visual-smoke coverage.

**Tech Stack:** React, TypeScript, Vitest, Vite, Agent Browser Settings, `localStorage` persistence, checked-in deterministic scripts, Playwright visual smoke. Kuzu-WASM remains the preferred future graph engine, but this slice provides an offline typed graph engine without adding a backend or network dependency.

---

## Linear Description

TK-30 asks for an offline-first browser app implementing persistent GraphRAG / PathRAG / agent-memory with local graph storage, tiered memory, retrieval, path expansion, activation retrieval, temporal and procedural recall, context pack generation, export/import, and visual graph inspection.

## Feature Implementation Plan

1. Add a typed graph-knowledge service that models hot memory blocks, source/evidence nodes, entities, claims, facts, events, atomic memories, skills, communities, path records, retrieval traces, and context packs.
2. Add deterministic offline ingestion and retrieval: lexical matching, entity resolution, short path expansion, activation scoring, community summaries, temporal caveats, procedural skill recall, contradiction detection, hot-memory promotion, consolidation, export, and import.
3. Add a typed worker message contract plus a local worker reducer so database, ingestion, retrieval, consolidation, and path operations have a clear off-main-thread boundary.
4. Persist graph knowledge state through `STORAGE_KEYS.graphKnowledgeState` and validate it defensively.
5. Add a Settings workbench with status, tier metrics, required controls, result tabs, score breakdowns, path explanations, graph preview, schema, and raw JSON.
6. Add App smoke and visual-smoke coverage; copy visual evidence into the plan folder for the PR body.

## Architecture-Aligned Technical Spec

### Service Contract

`agent-browser/src/services/graphKnowledge.ts` exports:

```ts
export interface GraphKnowledgeState;
export interface GraphKnowledgeSearchResult;
export interface GraphKnowledgeContextPack;

export function createEmptyGraphKnowledgeState(now?: string): GraphKnowledgeState;
export function loadSampleGraphKnowledge(now?: string): GraphKnowledgeState;
export function ingestGraphKnowledgeText(state, input): GraphKnowledgeState;
export function ingestGraphKnowledgeSession(state, input): GraphKnowledgeState;
export function ingestGraphKnowledgeSkill(state, input): GraphKnowledgeState;
export function searchGraphKnowledge(state, query, config?): GraphKnowledgeSearchResult;
export function buildGraphKnowledgeContextPack(state, query, config?): GraphKnowledgeContextPack;
export function promoteGraphKnowledgeToHotMemory(state, query): GraphKnowledgeState;
export function consolidateGraphKnowledge(state): GraphKnowledgeState;
export function exportGraphKnowledge(state): string;
export function importGraphKnowledge(serialized): GraphKnowledgeState;
export function getGraphKnowledgeStats(state): GraphKnowledgeStats;
export function isGraphKnowledgeState(value): value is GraphKnowledgeState;
```

### Worker Contract

`agent-browser/src/db/messages.ts` defines typed messages for `init`, `createSchema`, `loadSampleMemory`, `ingestText`, `ingestSession`, `ingestSkill`, `ingestTaskTrace`, `runQuery`, `searchMemory`, `retrieveHotMemory`, `retrieveLexical`, `retrieveEntities`, `retrievePaths`, `retrieveByActivation`, `retrieveCommunities`, `retrieveTemporal`, `retrieveProcedural`, `buildContextPack`, `consolidateMemory`, `promoteToHotMemory`, `evolveMemoryLinks`, `detectContradictions`, `getSchema`, `getMemoryStats`, `importMemory`, `exportMemory`, and `resetDatabase`.

`agent-browser/src/db/graphWorker.ts` owns a local state reducer for those messages. The first slice is dependency-free and deterministic, so it can be tested in Vitest and later moved behind a real `Worker` and Kuzu-WASM without changing UI calls.

### UI Contract

Settings gets a `Graph knowledge` section with:

- database status: initializing, ready, error, offline-ready;
- tier metrics for hot memory, graph nodes/edges, archive/session/skill counts;
- controls for Load Sample Memory, Ingest Text, Ingest Session, Add Skill, Search Memory, Generate Context Pack, Run Query, Consolidate Memory, Promote to Hot Memory, Evolve Links, Export Memory, Import Memory, and Reset Memory;
- result tabs: Context Pack, Hot Memory, Evidence, Facts & Claims, Paths, Communities, Skills, Graph, Table, Raw JSON;
- score breakdowns and local citation IDs;
- clear empty states and error messages.

### TDD Task Plan

### Task 1: Graph Knowledge Service

**Files:**
- Create: `agent-browser/src/services/graphKnowledge.ts`
- Create: `agent-browser/src/services/graphKnowledge.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
const state = loadSampleGraphKnowledge('2026-05-08T00:00:00.000Z');
const result = searchGraphKnowledge(state, 'How does Kuzu-WASM improve PathRAG retrieval?');
expect(result.entities.map((entity) => entity.canonicalName)).toContain('Kuzu-WASM');
expect(result.paths[0].explanation).toMatch(/matched query seed/i);
expect(buildGraphKnowledgeContextPack(state, 'offline graph memory').text).toContain('HOT MEMORY');
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/services/graphKnowledge.test.ts`
Expected: FAIL because `graphKnowledge.ts` does not exist.

- [ ] **Step 3: Implement the minimal service**

Create typed sample graph state, deterministic extractors, scoring, retrieval, path records, context-pack builder, promotion/consolidation, contradiction detection, export/import, and validation.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/services/graphKnowledge.test.ts`
Expected: PASS.

### Task 2: Worker Contract

**Files:**
- Create: `agent-browser/src/db/messages.ts`
- Create: `agent-browser/src/db/graphWorker.ts`
- Create: `agent-browser/src/db/graphWorker.test.ts`

- [ ] **Step 1: Write failing worker tests**

```ts
const worker = createGraphKnowledgeWorkerRuntime();
await worker.dispatch({ type: 'loadSampleMemory', now: '2026-05-08T00:00:00.000Z' });
const response = await worker.dispatch({ type: 'buildContextPack', query: 'offline PathRAG' });
expect(response.type).toBe('contextPackBuilt');
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/db/graphWorker.test.ts`
Expected: FAIL because the worker runtime does not exist.

- [ ] **Step 3: Implement the worker reducer**

Route every required operation to the service functions and return typed responses.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/db/graphWorker.test.ts`
Expected: PASS.

### Task 3: Settings Workbench

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/src/App.smoke.test.tsx`

- [ ] **Step 1: Write failing UI test**

```ts
fireEvent.click(screen.getByLabelText('Settings'));
fireEvent.click(screen.getByRole('button', { name: 'Graph knowledge' }));
expect(screen.getByText('Offline-ready graph memory')).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Load Sample Memory' })).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx -t "renders graph knowledge"`
Expected: FAIL because the section is missing.

- [ ] **Step 3: Implement the UI**

Add the persisted state hook, Settings panel, result tabs, controls, metrics, and responsive CSS.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx -t "renders graph knowledge"`
Expected: PASS.

### Task 4: Visual Smoke and Full Verification

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Add: `docs/superpowers/plans/2026-05-08-graph-knowledge-visual-smoke.png`

- [ ] **Step 1: Add visual smoke assertions**

Assert Settings exposes `Graph knowledge`, `Offline-ready graph memory`, `Context Pack`, `Paths`, `Communities`, and `Kuzu-WASM`.

- [ ] **Step 2: Run validation**

Run:

```powershell
npm.cmd --workspace agent-browser run test -- src/services/graphKnowledge.test.ts
npm.cmd --workspace agent-browser run test -- src/db/graphWorker.test.ts
npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx -t "renders graph knowledge"
npm.cmd --workspace agent-browser run test:scripts
npm.cmd run check:generated-files
npm.cmd run visual:agent-browser
npm.cmd run verify:agent-browser
```

Expected: all pass, with screenshot evidence copied into this plan folder.

## One-Shot LLM Prompt

```text
Implement Linear TK-30 in agent-browser as a complete offline graph-knowledge vertical slice.

Follow the existing Agent Browser architecture:
- Create a pure TypeScript `agent-browser/src/services/graphKnowledge.ts` service with typed graph-memory state, sample data, deterministic extraction, lexical/entity/path/activation/community/temporal/procedural retrieval, score breakdowns, context-pack generation, contradiction detection, promotion, consolidation, export/import, stats, and validation.
- Create `agent-browser/src/db/messages.ts` and `agent-browser/src/db/graphWorker.ts` as the typed worker contract and local reducer for the required graph worker API. Do not add a backend and do not make network calls.
- Add tests before implementation and verify RED first.
- Persist state with a new `STORAGE_KEYS.graphKnowledgeState` entry.
- Add a `Graph knowledge` Settings section in `agent-browser/src/App.tsx` with status metrics, controls, result tabs, path explanations, score breakdowns, schema, graph/table/raw views, empty states, and error messages.
- Add responsive CSS in `agent-browser/src/App.css`.
- Add App smoke and visual-smoke coverage and copy `output/playwright/agent-browser-visual-smoke.png` to `docs/superpowers/plans/2026-05-08-graph-knowledge-visual-smoke.png` after visual verification.

Use TDD. Keep this slice local-first and deterministic. Kuzu-WASM remains a future runtime adapter behind the worker boundary; this implementation must work offline today without a backend or network dependency.
```
