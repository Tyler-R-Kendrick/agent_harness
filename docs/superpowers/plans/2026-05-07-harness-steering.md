# Harness Steering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class Agent Browser steering memory so user corrections are stored in `.steering` documents, summarized for prompts, and managed by a dedicated Steering chat agent.

**Architecture:** Model steering as deterministic local app state first, with a service that owns the `.steering` file manifest, correction routing, Markdown rendering, prompt context, and validation. Surface it through Agent Browser Settings and chat-agent routing, then leave filesystem/tool-hook persistence as an explicit contract the Steering agent can enforce through existing workspace tools and future backend bridges.

**Tech Stack:** React, TypeScript, Vitest, localStorage-backed session state, existing chat-agent provider routing, Vite visual smoke.

---

## Feature Implementation Plan

TK-6 asks for a file-based steering memory rooted at `.steering/`, with `STEERING.md` as the summary index and derivative files for user, project, workspace, session, agent, and tool reasoning contexts. The implementation should make that structure visible and durable in Agent Browser, inject active steering into prompts, and provide a Steering agent that can read/write corrections through explicit instructions.

The first ship slice is:

- A deterministic `harnessSteering` service with canonical files, correction scopes, routing helpers, Markdown rendering, inventory summaries, validation, and prompt-context output.
- A durable `harnessSteeringState` storage key.
- A first-class `Steering` chat agent under `agent-browser/src/chat-agents/Steering/`.
- Provider/routing support so steering/correction requests can route to Steering.
- Settings UI for enabling steering memory, reviewing the `.steering` manifest, adding correction text, and seeing derivative file summaries.
- Smoke and visual coverage for the Settings surface.

## Technical Spec

### Data Model

Create `agent-browser/src/services/harnessSteering.ts`.

The canonical manifest is:

```ts
[
  { scope: 'summary', path: '.steering/STEERING.md' },
  { scope: 'user', path: '.steering/user.steering.md' },
  { scope: 'project', path: '.steering/project.steering.md' },
  { scope: 'workspace', path: '.steering/workspace.steering.md' },
  { scope: 'session', path: '.steering/session.steering.md' },
  { scope: 'agent', path: '.steering/agent.steering.md' },
  { scope: 'tool', path: '.steering/tool.steering.md' },
]
```

`HarnessSteeringState` stores `enabled`, `autoCapture`, `enforceWithHooks`, and an array of correction records. Corrections include id, scope, source, text, createdAt, updatedAt, and optional tags.

### Service Behavior

`createHarnessSteeringCorrection` normalizes correction text, picks a scope from explicit input or request text, rejects empty input, and stamps stable ids. `buildHarnessSteeringFiles` groups corrections into derivative Markdown documents and renders `STEERING.md` as a summary that references every derivative file. `buildHarnessSteeringInventory` returns counts, file rows, latest correction, and warnings. `buildHarnessSteeringPromptContext` emits concise prompt context only when enabled.

### Chat Agent

Create `agent-browser/src/chat-agents/Steering/index.ts`.

The Steering agent is model-backed like Planner, Researcher, Debugger, and Security. It should:

- Detect steering requests such as "remember this correction", "steering", "add this to project memory", and "correct your reasoning".
- Explain that `.steering/STEERING.md` is the summary index and derivative files own scope-specific rules.
- Instruct the runtime to preserve exact user correction text, route it to the right derivative file, update the summary index, and avoid rewriting unrelated steering scopes.
- Reuse existing tool instruction templates for selected workspace tools.

### UI

Add a `HarnessSteeringSettingsPanel` inside Settings near Harness core and workspace skill policies. The panel must use existing compact Settings patterns, avoid nested cards, expose checkboxes for enabled/auto-capture/hook enforcement, include a scope selector and text input for a new correction, and show canonical file rows with counts.

### Prompt Integration

Persist `harnessSteeringState` through `STORAGE_KEYS.harnessSteeringState`, compute an inventory in `AgentBrowserApp`, pass state/inventory into `ChatPanel`, and append `buildHarnessSteeringPromptContext(inventory)` to `requestWorkspacePromptContext`.

## One-Shot LLM Prompt

```text
You are implementing Linear TK-6 in Agent Browser. Add first-class Harness Steering memory.

Follow TDD. Start with failing tests for a new `agent-browser/src/services/harnessSteering.ts` service and a new `agent-browser/src/chat-agents/Steering/index.ts` agent module.

Build a deterministic TypeScript service that defines canonical `.steering` files: `.steering/STEERING.md`, `.steering/user.steering.md`, `.steering/project.steering.md`, `.steering/workspace.steering.md`, `.steering/session.steering.md`, `.steering/agent.steering.md`, and `.steering/tool.steering.md`. The service must validate persisted state, create normalized correction records, infer correction scope from text, render derivative Markdown files, render `STEERING.md` as a summary index that references derivative files, produce inventory rows/counts/warnings, and emit concise prompt context.

Add a model-backed Steering chat agent under `agent-browser/src/chat-agents/Steering/`. Wire it through `chat-agents/index.ts`, `AgentProvider`, display names, placeholders, provider summary, runtime provider resolution, task routing, and stream dispatch. The Steering agent must tell the model to preserve exact corrections, update only the target `.steering` derivative file, refresh `STEERING.md`, and enforce corrections through available skills/hooks.

Persist steering state using `STORAGE_KEYS.harnessSteeringState`. Add a Settings panel that shows the canonical file manifest, toggles enablement/auto-capture/hook enforcement, lets users add a scoped correction, and displays latest correction status. Add App smoke coverage and visual-smoke assertions. Run focused tests, `npm.cmd --workspace agent-browser run test:scripts`, `npm.cmd run visual:agent-browser`, and `npm.cmd run verify:agent-browser`.
```

## TDD Task Plan

### Task 1: Steering Service

**Files:**
- Create: `agent-browser/src/services/harnessSteering.test.ts`
- Create: `agent-browser/src/services/harnessSteering.ts`

- [ ] **Step 1: Write failing service tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HARNESS_STEERING_STATE,
  buildHarnessSteeringFiles,
  buildHarnessSteeringInventory,
  buildHarnessSteeringPromptContext,
  createHarnessSteeringCorrection,
  inferHarnessSteeringScope,
  isHarnessSteeringState,
} from './harnessSteering';

describe('harnessSteering', () => {
  it('creates scoped corrections and renders canonical steering files', () => {
    const correction = createHarnessSteeringCorrection({
      text: 'When the user says verify, run the full repo verifier.',
      source: 'manual',
      scope: 'workspace',
      now: new Date('2026-05-07T18:00:00.000Z'),
    });
    const state = { ...DEFAULT_HARNESS_STEERING_STATE, corrections: [correction] };
    const files = buildHarnessSteeringFiles(state);
    expect(files.map((file) => file.path)).toEqual([
      '.steering/STEERING.md',
      '.steering/user.steering.md',
      '.steering/project.steering.md',
      '.steering/workspace.steering.md',
      '.steering/session.steering.md',
      '.steering/agent.steering.md',
      '.steering/tool.steering.md',
    ]);
    expect(files.find((file) => file.scope === 'workspace')?.content).toContain('- When the user says verify, run the full repo verifier.');
    expect(files[0].content).toContain('[workspace](workspace.steering.md): 1 correction');
  });

  it('validates state, infers scopes, and builds prompt context', () => {
    expect(isHarnessSteeringState(DEFAULT_HARNESS_STEERING_STATE)).toBe(true);
    expect(isHarnessSteeringState({ enabled: true, corrections: [{ id: 'bad' }] })).toBe(false);
    expect(inferHarnessSteeringScope('Remember this tool correction for shell commands')).toBe('tool');
    const state = {
      ...DEFAULT_HARNESS_STEERING_STATE,
      corrections: [createHarnessSteeringCorrection({ text: 'Keep user corrections exact.', source: 'chat', scope: 'user' })],
    };
    const inventory = buildHarnessSteeringInventory(state);
    expect(inventory.enabled).toBe(true);
    expect(inventory.totalCorrections).toBe(1);
    expect(buildHarnessSteeringPromptContext(inventory)).toContain('## Harness Steering');
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser exec vitest run src/services/harnessSteering.test.ts`

Expected: FAIL because `./harnessSteering` does not exist.

- [ ] **Step 3: Implement minimal service**

Create exported types, defaults, validators, correction creation, file rendering, inventory, and prompt context.

- [ ] **Step 4: Run focused service test to verify GREEN**

Run: `npm.cmd --workspace agent-browser exec vitest run src/services/harnessSteering.test.ts`

Expected: PASS with 100% coverage for the new service.

### Task 2: Steering Agent

**Files:**
- Create: `agent-browser/src/chat-agents/Steering/index.test.ts`
- Create: `agent-browser/src/chat-agents/Steering/index.ts`
- Modify: `agent-browser/src/chat-agents/types.ts`
- Modify: `agent-browser/src/chat-agents/index.ts`

- [ ] **Step 1: Write failing chat-agent tests**
- [ ] **Step 2: Run test to verify RED**
- [ ] **Step 3: Implement Steering agent prompt, detection, exports, display, placeholder, runtime routing, and stream dispatch**
- [ ] **Step 4: Run focused chat-agent tests to verify GREEN**

### Task 3: App Integration

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/src/App.smoke.test.tsx`
- Modify: `agent-browser/scripts/visual-smoke.mjs`

- [ ] **Step 1: Write failing App smoke coverage for Settings Harness Steering**
- [ ] **Step 2: Add storage, memoized inventory, prompt context, Settings panel, correction form, and compact responsive styles**
- [ ] **Step 3: Add visual-smoke assertions and screenshot handoff path**
- [ ] **Step 4: Run focused App smoke and visual checks**

### Task 4: Verification and Publication

**Files:**
- Add visual evidence under `docs/superpowers/plans/`
- Update Linear TK-6
- Commit, push, open PR, add `codex` and `codex-automation` labels

- [ ] **Step 1: Run `npm.cmd --workspace agent-browser run test:scripts`**
- [ ] **Step 2: Run focused Vitest coverage for changed tests**
- [ ] **Step 3: Run `npm.cmd run visual:agent-browser` and copy screenshot to the plan folder**
- [ ] **Step 4: Run `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`**
- [ ] **Step 5: Commit, push, open PR, update Linear with PR and verification evidence, and move TK-6 to Done**

## Self-Review

Spec coverage is complete for the first Agent Browser slice: canonical `.steering` files, summary index, derivative scope files, dedicated agent, prompt context, settings UI, tests, visual validation, and PR flow. There are no placeholder task entries; deferred backend filesystem syncing is described as the future bridge beyond this deterministic browser implementation.
