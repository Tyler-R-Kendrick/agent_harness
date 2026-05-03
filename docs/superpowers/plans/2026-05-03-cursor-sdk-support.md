# Cursor SDK Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cursor as a first-class agent-browser chat provider alongside Codi and GHCP.

**Architecture:** Mirror the existing GHCP integration: a browser service streams NDJSON from a Vite server middleware, a `chat-agents/Cursor` module wraps it in the LogAct loop, and `App.tsx` exposes Cursor provider/model selection and readiness. The server bridge uses the public beta `@cursor/sdk` `Agent` API when available, while tests inject a fake client factory so provider behavior remains deterministic.

**Tech Stack:** React 18, TypeScript, Vite middleware, Vitest, `@cursor/sdk`, existing `streamAgentChat` provider routing, existing settings/provider UI.

---

## Source Issue

Linear TK-43: "Add Cursor as an agent to the agent-browser in the same way we support GHCP."

Cursor announced the public beta TypeScript SDK on April 29, 2026. The SDK package is `@cursor/sdk`; it creates agents with `Agent.create({ apiKey, model, local })`, sends prompts with `agent.send(...)`, and streams run events. Cursor's announcement says the same runtime supports local, cloud, and self-hosted workers, and exposes the harness/models that power Cursor desktop, CLI, and web.

## Feature Implementation Plan

1. Add a typed Cursor runtime service in `agent-browser/src/services/cursorApi.ts`.
2. Add a server-side Cursor SDK bridge in `agent-browser/server/cursorMiddleware.ts`.
3. Add `agent-browser/src/chat-agents/Cursor/index.ts` that mirrors GHCP prompt construction, reasoning marker filtering, completion checking, voters, and callbacks.
4. Extend `AgentProvider` and model-backed provider resolution from `'codi' | 'ghcp'` to `'codi' | 'ghcp' | 'cursor'`.
5. Wire provider summaries, placeholders, display names, model ID resolution, and `streamAgentChat` routing.
6. Add session storage for selected Cursor model IDs in `sessionState.ts` and App state.
7. Add Settings provider card and model list for Cursor, plus ChatPanel provider/model selector support.
8. Register the Cursor middleware in `vite.config.ts`.
9. Add dependency `@cursor/sdk` to `agent-browser/package.json`.
10. Verify with focused Vitest tests first, then `npm run verify:agent-browser` and `npm run visual:agent-browser` if subprocess spawning works.

## Technical Spec

### Cursor Runtime State

`CursorRuntimeState` should match Copilot's app contract:

```ts
export interface CursorModelSummary {
  id: string;
  name: string;
  contextWindow?: number;
  maxOutputTokens?: number;
}

export interface CursorRuntimeState {
  available: boolean;
  authenticated: boolean;
  authType?: 'api-key';
  statusMessage?: string;
  error?: string;
  models: CursorModelSummary[];
  signInCommand: string;
  signInDocsUrl: string;
}
```

Cursor is considered ready when `available`, `authenticated`, and at least one model exists. Default models should be static enough for public beta: `composer-2`, `gpt-5.5`, and `codex-5.3-high-fast`. The middleware should report unauthenticated when `CURSOR_API_KEY` is missing, rather than trying to start a run.

### Cursor Server Bridge

`CursorBridge` should expose:

```ts
class CursorBridge {
  async getStatus(): Promise<CursorStatusResponse>;
  async streamChat(
    request: Required<CursorChatRequest>,
    signal: AbortSignal,
    onEvent: (event: CursorStreamEvent) => void,
  ): Promise<void>;
}
```

`streamChat` should:

- Validate `CURSOR_API_KEY`.
- Create or reuse one SDK agent per `sessionId` and `modelId`.
- Call `agent.send(prompt)`.
- Iterate `run.stream()` and normalize unknown SDK event shapes into `{ type: 'token' | 'reasoning' | 'final' | 'done' | 'error' }`.
- Abort the active run when the browser request aborts if the SDK exposes `abort` or `cancel`.

### Chat Agent

`streamCursorChat` should use the same structure as `streamGhcpChat`:

- Build a workspace-grounded prompt from transcript and latest user input.
- Use `runAgentLoop` with voters and `createHeuristicCompletionChecker` for execution tasks.
- Split `###STEP:` and `###SEARCH:` marker lines into reasoning UI.
- Filter marker lines out of the final visible answer.

### App UI

The provider selector should include Cursor. Cursor should:

- Show as `Cursor: <model name>` in the header.
- Be selectable when a Cursor model is available.
- Show `Sign in to Cursor to start chatting` when unavailable.
- Surface Settings instructions: set `CURSOR_API_KEY`, then refresh status.
- Include Cursor availability in context summary and readable runtime context.

## TDD Tasks

### Task 1: Cursor API Client

**Files:**
- Create: `agent-browser/src/services/cursorApi.ts`
- Create test: `agent-browser/src/services/cursorApi.test.ts`

- [ ] Write tests that `fetchCursorState` reads `/api/cursor/status`, `streamCursorChat` parses NDJSON token/final/done events, and HTTP errors expose server messages.
- [ ] Run: `npm.cmd --workspace agent-browser run test -- src/services/cursorApi.test.ts`
- [ ] Implement `cursorApi.ts`.
- [ ] Rerun the focused test and confirm it passes.

### Task 2: Cursor Middleware

**Files:**
- Create: `agent-browser/server/cursorMiddleware.ts`
- Create test: `agent-browser/server/cursorMiddleware.test.ts`
- Modify: `agent-browser/vite.config.ts`
- Modify: `agent-browser/package.json`

- [ ] Write tests for missing API key, ready status with configured API key, model validation, and stream normalization from fake SDK events.
- [ ] Run: `npm.cmd --workspace agent-browser run test -- server/cursorMiddleware.test.ts`
- [ ] Implement the bridge and middleware.
- [ ] Register middleware in Vite.
- [ ] Add `@cursor/sdk` dependency.
- [ ] Rerun the focused test and confirm it passes.

### Task 3: Cursor Chat Agent

**Files:**
- Create: `agent-browser/src/chat-agents/Cursor/index.ts`
- Create test: `agent-browser/src/chat-agents/Cursor/index.test.ts`
- Modify: `agent-browser/src/chat-agents/index.ts`
- Modify: `agent-browser/src/chat-agents/types.ts`
- Modify test: `agent-browser/src/chat-agents/index.test.ts`

- [ ] Write tests for Cursor readiness, model fallback, display names, placeholders, provider summaries, direct `streamAgentChat` routing, and runtime-provider fallback for Researcher/Debugger/Planner.
- [ ] Run focused chat-agent tests.
- [ ] Implement provider types and Cursor module.
- [ ] Rerun focused chat-agent tests.

### Task 4: App Wiring and Persistence

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify test: `agent-browser/src/services/sessionState.test.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify tests: `agent-browser/src/App.test.tsx`, `agent-browser/src/App.persistence.test.tsx` if existing coverage requires it.

- [ ] Write tests proving Cursor provider values survive session storage validation and render in provider controls.
- [ ] Run focused App/session tests.
- [ ] Add Cursor state, refresh, selected model storage, Settings card, ChatPanel selector, can-submit gating, and send-message model routing.
- [ ] Rerun focused tests.

### Task 5: Verification and Publication

**Files:**
- Update: Linear TK-43 comments.
- Create: visual screenshot if `npm run visual:agent-browser` succeeds.

- [ ] Run `npm.cmd --workspace agent-browser run lint`.
- [ ] Run `npm.cmd run verify:agent-browser`.
- [ ] Run or rely on `npm.cmd run visual:agent-browser`; attach `output/playwright/agent-browser-visual-smoke.png` in PR description if produced.
- [ ] Commit with `scripts/codex-git.ps1`.
- [ ] Push and open PR with `scripts/codex-gh.ps1`; add `codex` and `codex-automation` labels.
- [ ] Move TK-43 to Done only after the PR is created and validation is complete.

## One-Shot LLM Prompt

Implement Linear TK-43 in `agent-browser`: add Cursor SDK support as a first-class chat provider in the same style as GHCP. Use TDD. First add tests for a Cursor API client, server middleware, chat-agent provider routing, session persistence, and App provider/model UI. Then implement `agent-browser/src/services/cursorApi.ts`, `agent-browser/server/cursorMiddleware.ts`, `agent-browser/src/chat-agents/Cursor/index.ts`, provider type/routing updates, Vite middleware registration, `@cursor/sdk` dependency, and App settings/header/composer wiring. Cursor status should require `CURSOR_API_KEY`, expose default public-beta model IDs, stream normalized NDJSON events from the SDK, and surface clear sign-in/setup guidance when unavailable. Reuse GHCP prompt construction, LogAct loop, voter callbacks, completion checker behavior, reasoning marker splitting, and final marker filtering. Run focused tests first, then the full `npm run verify:agent-browser` and visual smoke script, and include screenshots in the PR if visual smoke succeeds.

## Self-Review

- Spec coverage: The plan covers server SDK bridge, browser service, chat agent, App UI, persistence, tests, verification, Linear, and PR flow.
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: Provider names use `cursor`; runtime state uses `CursorRuntimeState`; selected model storage uses Cursor-specific keys.
