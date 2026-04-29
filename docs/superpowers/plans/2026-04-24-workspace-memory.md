# Workspace Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workspace-scoped file-backed memory to agent-browser using `.memory` markdown files, a Memory agent service, and a default agent skill that tells agents how to use it.

**Architecture:** Keep the implementation inside the existing browser-stored `WorkspaceFile[]` model. Add a focused `workspaceMemory` service that creates default memory files, parses bullet memories, searches scope-aware entries, and writes new factoids. Feed memory context into `buildWorkspacePromptContext` so existing agent prompt construction and tool instructions automatically include relevant memory guidance.

**Tech Stack:** React/Vite app, TypeScript, Vitest, browser localStorage-backed workspace files, existing default agent skill bundling through `agent-browser/agent-skills`.

---

## Feature Implementation Plan

`TK-5 Workspace Memory` asks for:
- a `.memory/` folder with `MEMORY.md`;
- scoped files `user.memory.md`, `project.memory.md`, `workspace.memory.md`, and `session.memory.md`;
- markdown list-item factoids as the storage format;
- a Memory agent responsible for reading and writing memories using file-based RAG;
- an agent-browser skill that enforces use of the memory system through that Memory agent.

The narrow implementation is:
1. Treat memory files as first-class `WorkspaceFile` entries.
2. Initialize every workspace with the five memory files alongside the current bundled `.agents/skills`.
3. Provide pure functions for Memory-agent behavior: discover files, parse markdown bullets, search entries by query/scope, and append sanitized factoids.
4. Include a compact memory recall section in workspace prompt context so every agent/tool-routing prompt knows to consult/write memory.
5. Bundle a default `memory` skill into agent-browser so new workspaces get `.agents/skills/memory/SKILL.md`.

## Technical Spec

### Data Model

Add these paths to every workspace:
- `.memory/MEMORY.md`
- `.memory/user.memory.md`
- `.memory/project.memory.md`
- `.memory/workspace.memory.md`
- `.memory/session.memory.md`

Each file stores factoids as markdown list items. Blank files are valid, but default templates include a heading and one HTML comment describing the scope. Only top-level list items beginning with `- ` or `* ` are considered memory entries.

### Service API

Create `agent-browser/src/services/workspaceMemory.ts`:
- `MEMORY_FILE_DEFINITIONS`: ordered definitions for each scope/path.
- `createDefaultWorkspaceMemoryFiles(updatedAt)`: returns default `WorkspaceFile[]`.
- `mergeDefaultWorkspaceMemoryFiles(files, updatedAt)`: appends missing memory files without overwriting existing user content.
- `detectWorkspaceMemoryScope(path)`: returns the scope for known memory paths.
- `parseWorkspaceMemoryFiles(files)`: returns entries with `scope`, `path`, `text`, and `lineNumber`.
- `searchWorkspaceMemory(files, query, options?)`: lowercase token search over parsed entries, sorted by score, scope priority, and source order.
- `appendWorkspaceMemoryFact(files, scope, fact, updatedAt)`: sanitizes one factoid and appends it to the scoped memory file, creating the file if missing.
- `buildWorkspaceMemoryPromptContext(files, query?)`: compact prompt section listing stored memory entries or noting that no factoids exist yet.

### Workspace Integration

Modify `agent-browser/src/services/workspaceFiles.ts`:
- Extend `WorkspaceFileKind` with `memory`.
- Include default memory files from `createDefaultWorkspaceFiles`.
- Merge missing memory files during `loadWorkspaceFiles`.
- Let `detectWorkspaceFileKind` and `validateWorkspaceFile` accept only known `.memory` paths.
- Add memory context to `buildWorkspacePromptContext`.
- Include memory files in the empty-capabilities check so an all-default workspace still has useful prompt context.

Modify `agent-browser/src/types/index.ts`:
- Add `memory` to `WorkspaceFileKind`.

Modify `agent-browser/src/services/agentPromptTemplates.ts`:
- Strengthen `buildMemoryRecallTemplate` to explicitly say file-backed memory is owned by the Memory agent and stored in `.memory/*.memory.md`.
- Keep the prompt generic enough that existing tests for scenario selection still pass.

### Agent Skill

Add `agent-browser/agent-skills/memory/SKILL.md`:
- Frontmatter: `name: memory`, description indicating use for recall/store/update of durable workspace memory.
- Workflow: inspect `.memory` files, search relevant scope, append factoids as markdown bullets, avoid secrets/noise, report stale/uncertain memory.

Existing `defaultAgentSkills.ts` will automatically bundle this into `.agents/skills/memory/SKILL.md`.

## One-Shot LLM Prompt

Implement `TK-5 Workspace Memory` in `C:\Users\conta\.codex\worktrees\3076\agent-harness`.

Use TDD. Add tests first, run them and confirm they fail for missing workspace memory behavior, then implement the minimal TypeScript changes.

Requirements:
- Add default workspace memory files under `.memory/`: `MEMORY.md`, `user.memory.md`, `project.memory.md`, `workspace.memory.md`, `session.memory.md`.
- Preserve user content when default memory files are merged into stored workspace files.
- Treat memory files as a supported workspace file kind with strict validation limited to the five known paths.
- Add a pure `workspaceMemory` service that creates/merges defaults, parses markdown list factoids, searches factoids by query/scope, appends sanitized factoids, and builds prompt memory context.
- Include memory context in `buildWorkspacePromptContext`.
- Add a default bundled `memory` agent skill under `agent-browser/agent-skills/memory/SKILL.md`.
- Update tests in `agent-browser/src/services/workspaceFiles.test.ts` and add `agent-browser/src/services/workspaceMemory.test.ts`.
- Run the targeted tests, then `npm run verify:agent-browser` from the repo root.

Keep the diff narrow. Do not add UI unless tests show an existing surface must change. Use existing app patterns and avoid new runtime dependencies.

## TDD Plan

### Task 1: Workspace Memory Service

**Files:**
- Create: `agent-browser/src/services/workspaceMemory.ts`
- Test: `agent-browser/src/services/workspaceMemory.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that assert:
- default memory files are created in the expected order;
- markdown bullet factoids parse with scope/path/line number;
- search ranks matching scoped entries;
- appending a fact sanitizes multiline text and creates a missing scoped file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace agent-browser run test -- src/services/workspaceMemory.test.ts`
Expected: FAIL because `./workspaceMemory` does not exist.

- [ ] **Step 3: Implement minimal service**

Create `workspaceMemory.ts` with pure functions only; no browser APIs.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace agent-browser run test -- src/services/workspaceMemory.test.ts`
Expected: PASS.

### Task 2: Workspace Integration

**Files:**
- Modify: `agent-browser/src/types/index.ts`
- Modify: `agent-browser/src/services/workspaceFiles.ts`
- Modify: `agent-browser/src/services/workspaceFiles.test.ts`

- [ ] **Step 1: Write failing tests**

Extend workspace file tests to assert:
- `createDefaultWorkspaceFiles` includes five `.memory` files plus existing skill defaults;
- loading stored files merges missing memory files without overwriting existing `.memory/MEMORY.md`;
- `.memory/workspace.memory.md` validates while unknown `.memory/other.md` is rejected;
- prompt context includes a memory section with parsed factoids.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace agent-browser run test -- src/services/workspaceFiles.test.ts`
Expected: FAIL because memory files are not yet included.

- [ ] **Step 3: Implement integration**

Wire default memory files and prompt context into `workspaceFiles.ts`; update `WorkspaceFileKind`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace agent-browser run test -- src/services/workspaceFiles.test.ts`
Expected: PASS.

### Task 3: Memory Prompt and Skill

**Files:**
- Modify: `agent-browser/src/services/agentPromptTemplates.ts`
- Test: `agent-browser/src/services/agentPromptTemplates.test.ts`
- Create: `agent-browser/agent-skills/memory/SKILL.md`

- [ ] **Step 1: Write failing tests**

Add assertions that memory recall prompt mentions `.memory` files and Memory agent ownership, and that default workspace files include `.agents/skills/memory/SKILL.md`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm --workspace agent-browser run test -- src/services/agentPromptTemplates.test.ts src/services/workspaceFiles.test.ts`
Expected: FAIL until prompt text and bundled skill exist.

- [ ] **Step 3: Implement prompt and skill**

Update memory guidance and add the bundled skill file.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm --workspace agent-browser run test -- src/services/agentPromptTemplates.test.ts src/services/workspaceFiles.test.ts`
Expected: PASS.

### Task 4: Full Verification

**Files:**
- No additional files expected.

- [ ] **Step 1: Run targeted coverage**

Run: `npm --workspace agent-browser run test:coverage -- src/services/workspaceMemory.test.ts src/services/workspaceFiles.test.ts src/services/agentPromptTemplates.test.ts`
Expected: PASS with coverage output.

- [ ] **Step 2: Run required full agent-browser verification**

Run: `npm run verify:agent-browser`
Expected: PASS; visual smoke writes `output/playwright/agent-browser-visual-smoke.png`.

- [ ] **Step 3: Review visuals**

Inspect the visual smoke screenshot. Since this implementation is prompt/service/skill behavior and does not introduce a visible UI change, confirm the app shell still renders without layout regressions.
