# Codex SDK Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add Codex as a first-class `agent-browser` chat agent provider in the same provider/routing surface as GHCP.

**Architecture:** Codex is a model-backed provider next to Codi and GHCP. The browser talks to a Vite middleware through `/api/codex/status` and `/api/codex/chat`; the middleware invokes the installed `@openai/codex` CLI with `codex exec --json`, normalizes JSONL events, and streams Agent Browser NDJSON events back to the UI. Direct Codex chat turns bypass the existing browser-tool pipeline because Codex CLI owns its local agent/tool loop, while the existing pipeline assumes a wrapped AI SDK language model or in-browser local model.

**Tech Stack:** React, TypeScript, Vite middleware, Vitest, `@openai/codex` CLI, existing Agent Browser chat-agent and process UI conventions.

---

## Feature Implementation Plan

The Linear issue says: "Add Codex as an agent to the agent-browser in the same way we support GHCP." That means the user should be able to select Codex in the Agent provider dropdown, see Codex availability in Settings, choose the default Codex model entry, send a prompt, and receive streamed output through the same chat-agent callback surface used by GHCP.

## Technical Spec

### Provider Contract

- Extend `ModelBackedAgentProvider` from `codi | ghcp` to `codi | ghcp | codex`.
- Extend `AgentProvider` with `codex`.
- Add `CodexRuntimeState`, `CodexModelSummary`, `fetchCodexState`, and `streamCodexChat`.
- Add `chat-agents/Codex` with:
  - `CODEX_LABEL = 'Codex'`
  - `hasCodexAccess(state)`
  - `resolveCodexModelId(models, selectedModelId)`
  - `buildCodexPrompt(...)`
  - `streamCodexChat(...)`
- Keep the Codex prompt shape aligned with GHCP: workspace context, transcript, and latest user request.

### Server Contract

- Add `agent-browser/server/codexMiddleware.ts`.
- `GET /api/codex/status` returns a usable state when `codex --version` succeeds:

```json
{
  "available": true,
  "authenticated": true,
  "version": "0.125.0",
  "models": [{ "id": "codex-default", "name": "Codex default", "reasoning": true, "vision": false }],
  "signInCommand": "codex login",
  "signInDocsUrl": "https://developers.openai.com/codex/auth"
}
```

- `POST /api/codex/chat` requires `modelId`, `prompt`, and `sessionId`.
- `codex-default` runs `codex exec --json --color never --sandbox workspace-write --ask-for-approval never -C <cwd> -`.
- Non-default model IDs also add `--model <modelId>`.
- Stream parser accepts common Codex JSONL event shapes and emits existing browser NDJSON event types: `token`, `reasoning`, `final`, `done`, `error`.

### UI Contract

- Provider dropdown includes `Codex`.
- If Codex is selected, model selector shows Codex models or a Settings action.
- Composer placeholder says `Ask Codex...` when ready and `Sign in to Codex to start chatting` when unavailable.
- Settings Providers card shows Codex CLI status, sign-in command, and refresh action.
- Settings top badge includes Codex model count.

### One-Shot Prompt For An LLM

```text
Implement Linear TK-44 in agent-browser: add Codex as a first-class chat agent provider alongside GHCP and Codi. Follow the existing GHCP architecture: server middleware, browser API client, chat-agent wrapper, provider helpers, App provider dropdown/model selector/status/settings wiring, and tests. Use TDD. The Codex server bridge should invoke the installed @openai/codex CLI through `codex exec --json` and normalize JSONL events into the existing NDJSON stream event shape. Direct Codex chat turns should stream through the Codex bridge rather than the browser tool pipeline because Codex owns its local agent loop and the existing pipeline requires GHCP/Codi language-model wrappers. Save the plan/spec, add focused tests, run full `npm run verify:agent-browser`, capture visual smoke, commit, push, open a PR, label it `codex` and `codex-automation`, link Linear, then move TK-44 to Done.
```

---

## File Structure

- Create: `agent-browser/server/codexMiddleware.ts` for Codex CLI status, process execution, JSONL normalization, and Vite middleware.
- Create: `agent-browser/server/codexMiddleware.test.ts` for fake-process bridge tests.
- Create: `agent-browser/src/services/codexApi.ts` for browser status/chat API calls.
- Create: `agent-browser/src/services/codexApi.test.ts` for fetch and stream parsing tests.
- Create: `agent-browser/src/chat-agents/Codex/index.ts` for Codex prompt and stream wrapper.
- Create: `agent-browser/src/chat-agents/Codex/index.test.ts` for access, prompt, streaming, and retry tests.
- Modify: `agent-browser/src/chat-agents/types.ts` to include `codex`.
- Modify: `agent-browser/src/chat-agents/index.ts` and `index.test.ts` for provider helpers and stream routing.
- Modify: `agent-browser/src/App.tsx` and focused app tests for provider dropdown/settings/composer wiring.
- Modify: `agent-browser/src/services/sessionState.ts` and tests for selected Codex model storage.
- Modify: `agent-browser/vite.config.ts` to install Codex middleware.

---

### Task 1: Red Tests For Provider And Chat Agent

**Files:**
- Create: `agent-browser/src/chat-agents/Codex/index.test.ts`
- Modify: `agent-browser/src/chat-agents/index.test.ts`
- Modify: `agent-browser/src/chat-agents/types.ts`

- [x] **Step 1: Write the failing Codex chat-agent test**

Add tests that import `buildCodexPrompt`, `hasCodexAccess`, `resolveCodexModelId`, and `streamCodexChat`, mock `streamCodexRuntimeChat`, and assert prompt/routing behavior mirrors GHCP.

- [x] **Step 2: Run red test**

Run: `npm.cmd --workspace agent-browser run test -- src/chat-agents/Codex/index.test.ts src/chat-agents/index.test.ts`

Expected: FAIL because `chat-agents/Codex` and `codex` provider helpers do not exist yet.

- [x] **Step 3: Implement minimal provider and chat agent**

Create Codex wrapper by following the GHCP wrapper with Codex names and `streamCodexRuntimeChat`.

- [x] **Step 4: Run green test**

Run: `npm.cmd --workspace agent-browser run test -- src/chat-agents/Codex/index.test.ts src/chat-agents/index.test.ts`

Expected: PASS.

### Task 2: Red Tests For Codex Browser API

**Files:**
- Create: `agent-browser/src/services/codexApi.test.ts`
- Create: `agent-browser/src/services/codexApi.ts`

- [x] **Step 1: Write failing fetch/stream tests**

Assert `fetchCodexState` calls `/api/codex/status`, `streamCodexRuntimeChat` posts to `/api/codex/chat`, dispatches `token`, `reasoning`, `final`, `done`, and turns non-OK responses into useful errors.

- [x] **Step 2: Run red test**

Run: `npm.cmd --workspace agent-browser run test -- src/services/codexApi.test.ts`

Expected: FAIL because `codexApi.ts` does not exist.

- [x] **Step 3: Implement minimal browser API**

Mirror `copilotApi.ts`, keeping event parsing small and typed.

- [x] **Step 4: Run green test**

Run: `npm.cmd --workspace agent-browser run test -- src/services/codexApi.test.ts`

Expected: PASS.

### Task 3: Red Tests For Codex Server Middleware

**Files:**
- Create: `agent-browser/server/codexMiddleware.test.ts`
- Create: `agent-browser/server/codexMiddleware.ts`
- Modify: `agent-browser/vite.config.ts`

- [x] **Step 1: Write fake-process bridge tests**

Assert status succeeds from `codex --version`, status failure gives sign-in guidance, `streamChat` spawns `codex exec --json`, parses JSONL into token/final/done events, and abort kills the spawned process.

- [x] **Step 2: Run red test**

Run: `npm.cmd --workspace agent-browser run test -- server/codexMiddleware.test.ts`

Expected: FAIL because middleware is missing.

- [x] **Step 3: Implement minimal middleware**

Use injected process factories for tests. Register middleware in `vite.config.ts` after the Copilot middleware.

- [x] **Step 4: Run green test**

Run: `npm.cmd --workspace agent-browser run test -- server/codexMiddleware.test.ts`

Expected: PASS.

### Task 4: App Wiring And Visual Surface

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: focused `agent-browser/src/App.test.tsx`
- Modify: `agent-browser/src/services/sessionState.ts`

- [x] **Step 1: Write failing app tests**

Assert Codex appears in the provider dropdown, status card renders in Settings, selected Codex provider can submit when Codex is available, and Codex sends do not require an installed Codi model.

- [x] **Step 2: Run red app tests**

Run focused App test names with `npm.cmd --workspace agent-browser run test -- src/App.test.tsx -t "Codex"`

Expected: FAIL.

- [x] **Step 3: Implement app state and UI**

Add Codex state refresh, selected Codex model storage, provider option, model selector, settings provider card, composer status, and direct-stream routing.

- [x] **Step 4: Run green app tests**

Run: `npm.cmd --workspace agent-browser run test -- src/App.test.tsx -t "Codex"`

Expected: PASS.

### Task 5: Full Verification And PR

**Files:**
- All changed files.

- [x] **Step 1: Run focused tests**

Run each focused command from Tasks 1-4.

- [x] **Step 2: Run full gate**

Run: `npm.cmd run verify:agent-browser`

Expected: PASS.

- [x] **Step 3: Capture visual smoke**

Use `npm.cmd run visual:agent-browser`; keep `output/playwright/agent-browser-visual-smoke.png` for PR evidence and copy a stable screenshot into this plan folder if needed for PR markdown.

- [x] **Step 4: Commit and PR**

Create branch `codex/tk-44-codex-sdk-support`, commit, push, open PR, add labels `codex` and `codex-automation`, link Linear TK-44, and move Linear to Done after PR creation.

---

## Self-Review

- Spec coverage: provider contract, server bridge, browser API, app UI, direct Codex routing, tests, visual validation, and PR/Linear workflow are covered.
- Placeholder scan: no TBD/TODO placeholders remain.

## Completion Evidence

- `npm.cmd --workspace agent-browser run test:scripts` passed.
- `npm.cmd --workspace agent-browser run lint` passed.
- `npm.cmd run verify:agent-browser` passed, including coverage, build, audit, and visual smoke.
- Visual smoke screenshot: `docs/superpowers/plans/2026-05-02-codex-sdk-support-visual-smoke.png`.
- Type consistency: provider id is consistently `codex`, label is `Codex`, default model id is `codex-default`, and API paths are `/api/codex/status` and `/api/codex/chat`.
