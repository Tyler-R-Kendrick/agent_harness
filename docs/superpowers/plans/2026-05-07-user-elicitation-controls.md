# User Elicitation Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render structured MCP user-elicitation requests as typed inline app controls and resume chat with the collected structured payload.

**Architecture:** Extend the existing `webmcp:elicit_user_input` tool contract in `lib/agent-browser-mcp` rather than adding a parallel app surface. The Agent Browser chat already appends `kind: 'elicitation'` cards from `onElicitUserInput`; this feature broadens the field schema, renders each supported field type in `McpElicitationCard`, and submits a generic structured response while preserving location-memory behavior when a location field is present.

**Tech Stack:** TypeScript, React, Vite, Vitest, Testing Library, Playwright visual smoke.

---

## Feature Implementation Plan

TK-28 asks that structured user elicitation render an MCP app control instead of freeform chat. The existing app has the correct high-level seam: `registerWorkspaceTools(... onElicitUserInput ...)` dispatches a `USER_ELICITATION_EVENT`, `App.tsx` appends an inline chat card, and `McpElicitationCard` submits values back through chat. The gap is that the field contract only supports text inputs and the submit path collapses responses into `Location: ...`.

The implementation will:

- Add typed elicitation fields: `text`, `textarea`, `select`, `checkbox`, and `number`.
- Add select options and default values to the MCP library contract.
- Normalize invalid field metadata safely in `lib/agent-browser-mcp/src/userContextTools.ts`.
- Render each field type with accessible labels and existing chat-card styling.
- Submit the full structured response as JSON back into chat.
- Preserve the existing location memory update when the submitted values include `location`.
- Add App smoke coverage and MCP library normalization coverage.
- Add visual smoke assertions for the structured elicitation card.

## Technical Spec

### Contract

`WorkspaceMcpElicitationField` becomes:

```ts
export type WorkspaceMcpElicitationFieldType = 'text' | 'textarea' | 'select' | 'checkbox' | 'number';

export interface WorkspaceMcpElicitationOption {
  label: string;
  value: string;
}

export interface WorkspaceMcpElicitationField {
  id: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  type?: WorkspaceMcpElicitationFieldType;
  options?: readonly WorkspaceMcpElicitationOption[];
  defaultValue?: string;
}
```

Unsupported types normalize to `text`. Select options require non-empty `label` and `value`; invalid options are discarded. A select field with no valid options remains a select control so the UI can render an empty disabled placeholder.

### App Behavior

`McpElicitationCard` initializes values from `card.response`, then `field.defaultValue`, then an empty string. Checkboxes use string values `"true"` and `"false"` so the existing `Record<string, string>` response type remains stable.

Rendering rules:

- `textarea`: multiline `<textarea>`.
- `select`: `<select>` with a disabled placeholder option plus normalized options.
- `checkbox`: checkbox row with the label as the accessible name.
- `number`: numeric `<input>`.
- default/text: text `<input>`.

On submit, `handleElicitationSubmit` marks the card submitted with all values, updates location memory only if `values.location` is present, and sends:

```text
User input for <requestId>:
<pretty JSON payload>
```

### Files

- Modify: `lib/agent-browser-mcp/src/workspaceToolTypes.ts`
- Modify: `lib/agent-browser-mcp/src/userContextTools.ts`
- Modify: `lib/agent-browser-mcp/src/__tests__/userContextTools.test.ts`
- Modify: `agent-browser/src/types/index.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/src/App.smoke.test.tsx`
- Modify: `agent-browser/scripts/visual-smoke.mjs`

## One-Shot LLM Prompt

Implement TK-28 in `agent-harness`: structured MCP user elicitation controls for Agent Browser. Start with failing tests. Extend `WorkspaceMcpElicitationField` in `lib/agent-browser-mcp` with typed fields (`text`, `textarea`, `select`, `checkbox`, `number`), select options, and default values. Normalize invalid field metadata in `userContextTools.ts` and update the tool JSON schema. In `agent-browser`, update `McpElicitationCard` to render accessible controls for each type using existing message-card styles. Submit the full structured `Record<string,string>` payload back into chat instead of reducing every response to `Location: ...`; keep the existing location-memory update when a `location` value exists. Add Vitest/Testing Library coverage for MCP normalization and App rendering/submission, then update `visual-smoke.mjs` to seed and assert a structured elicitation card. Run focused tests, script tests, `visual:agent-browser`, and the full `verify:agent-browser` gate.

## TDD Task Breakdown

### Task 1: MCP Field Contract

**Files:**
- Modify: `lib/agent-browser-mcp/src/workspaceToolTypes.ts`
- Modify: `lib/agent-browser-mcp/src/userContextTools.ts`
- Test: `lib/agent-browser-mcp/src/__tests__/userContextTools.test.ts`

- [ ] **Step 1: Write failing normalization test**

Add a test that sends mixed `textarea`, `select`, `checkbox`, `number`, invalid type, valid options, invalid options, and default values through `elicit_user_input`.

- [ ] **Step 2: Run test and verify RED**

Run: `npm.cmd --workspace @agent-harness/agent-browser-mcp run test -- userContextTools.test.ts`

Expected: FAIL because `type`, `options`, and `defaultValue` are not preserved.

- [ ] **Step 3: Implement field types**

Add the exported types and update `normalizeFields` plus the tool schema.

- [ ] **Step 4: Run test and verify GREEN**

Run the same focused test. Expected: PASS.

### Task 2: Agent Browser Elicitation Card

**Files:**
- Modify: `agent-browser/src/types/index.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`
- Test: `agent-browser/src/App.smoke.test.tsx`

- [ ] **Step 1: Write failing App smoke test**

Seed chat storage with a pending elicitation card containing textarea, select, checkbox, and number fields. Assert each typed control renders, submit the form, and assert the submitted response preserves all field values.

- [ ] **Step 2: Run test and verify RED**

Run: `npm.cmd --workspace agent-browser run test:app -- App.smoke.test.tsx`

Expected: FAIL because all controls render as text inputs and generic structured submission is absent.

- [ ] **Step 3: Implement typed controls and generic submission**

Render controls based on field type, update styling for select/textarea/checkbox, and change `handleElicitationSubmit` to send the full structured payload while retaining location memory.

- [ ] **Step 4: Run test and verify GREEN**

Run the same focused App smoke test. Expected: PASS.

### Task 3: Visual Smoke Coverage

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`

- [ ] **Step 1: Add visual smoke assertions**

Seed a structured elicitation card into the visual smoke workspace and assert the card, select, checkbox, textarea, and number field are visible before taking the screenshot.

- [ ] **Step 2: Run visual smoke**

Run: `npm.cmd run visual:agent-browser`

Expected: PASS and screenshot written to `output/playwright/agent-browser-visual-smoke.png`.

### Task 4: Final Verification and Publication

**Files:**
- All changed files

- [ ] **Step 1: Run repo gates**

Run:

```powershell
npm.cmd --workspace agent-browser run test:scripts
npm.cmd run check:generated-files
npm.cmd run verify:agent-browser
```

- [ ] **Step 2: Commit and PR**

Create branch `codex/tk-28-user-elicitation-controls`, commit the implementation, push, open a PR, attach the visual screenshot path in the PR body, add `codex` and `codex-automation` labels, and link the PR to TK-28.

- [ ] **Step 3: Complete Linear**

Move TK-28 to Done only after local verification and PR publication succeed, or leave a precise blocker comment if sandbox restrictions prevent publication.

## Self-Review

- Spec coverage: The plan covers field schema, app rendering, structured submission, visual smoke, and Linear/PR completion.
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: `WorkspaceMcpElicitationField` and `McpCard.fields` use the same field shape; App response remains `Record<string, string>`.
