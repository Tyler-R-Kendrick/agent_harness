# Agent Browser Customizable Harness Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Agent Browser’s default experience a json-render-compatible, editable widget canvas, then migrate the whole harness shell so every major component is represented by editable, extensible widget/spec nodes.

**Architecture:** Treat Space Agent’s spaces feature as the behavioral baseline, but implement it as a typed React/json-render composition system instead of executable widget source files. A persisted `HarnessAppSpec` describes the full app shell and nested widgets; a guarded catalog maps element types to real Agent Browser components and extension points; a dashboard/infinite canvas becomes the first default renderer.

**Tech Stack:** React, TypeScript, Vitest, Playwright, `@dnd-kit`, Vercel AI SDK, json-render concepts/packages where compatible, zod, existing WebMCP/workspace state services.

---

## Research Inputs

- Space Agent source requirements:
  - `app/L0/_all/mod/_core/spaces/constants.js`: schema ids, `~/spaces/`, signed grid range, default 6x3 widgets, size presets.
  - `app/L0/_all/mod/_core/spaces/layout.js`: collision-safe signed coordinates, centered first-fit packing, minimize-as-one-row behavior, first-fit placement for new widgets.
  - `app/L0/_all/mod/_core/spaces/widget-sdk-core.js`: guarded widget definitions, API versioning, size normalization.
  - `app/L0/_all/mod/_core/spaces/widget-render.js`: simple fallback renderer for primitive/object widget returns.
  - `app/L0/_all/mod/_core/spaces/prompt-context.js`: compact agent context rows for spaces and current widgets.
  - `app/L0/_all/mod/_core/spaces/dashboard-launcher.html`: create card, existing cards, duplicate/delete controls, empty state.
  - `app/L0/_all/mod/_core/spaces/AGENTS.md`: canvas behavior, widget shell behavior, and dashboard integration constraints.
- json-render requirements:
  - `https://json-render.dev/docs`: catalog-constrained generated UI, flat `root` plus `elements` specs, native rendering.
  - `https://json-render.dev/examples`: dashboard, MCP app, chat, no-AI examples.
  - `https://github.com/vercel-labs/json-render/tree/main/examples/dashboard`: streaming widget generation, catalog actions, persistence, drag/drop reorder, edit prompts.
- Protocol research:
  - A2UI is a declarative UI protocol for agent-generated, platform-agnostic UI streams.
  - AG-UI is the event/state protocol for agent/user application interaction, not the widget grammar itself.
  - MCP Apps are iframe-delivered interactive tool UIs. Keep them as importable widget surfaces, not the core in-app renderer.
- Screenshots captured as requirements:
  - `agent-browser/docs/screenshots/research/json-render-dashboard-demo.png`: empty dashboard grid with an add-widget slot.
  - `agent-browser/docs/screenshots/research/json-render-dashboard-add-widget.png`: prompt/edit card plus suggested widget prompts.
  - `agent-browser/docs/screenshots/research/space-agent-public-login.png`: Space Agent entry/login visual context.
  - Space Agent dashboard/canvas screenshots were attempted locally and against the public guest flow, but the app hydrated to a blank dark shell in headless Chromium. Use source evidence above for Space Agent behavioral requirements.
- Implementation screenshot:
  - `output/playwright/agent-browser-visual-smoke.png`: default Agent Browser harness dashboard with editable widgets, add-widget prompt card, and the existing chat/sidebar surfaces beside it.
- json-render package note:
  - `@json-render/react@0.18.0` currently peers React `^19.2.3`; Agent Browser is on React 18. The first implementation keeps the spec shape json-render-compatible through a local catalog renderer, with a package swap planned after React/package compatibility is proven.

## File Structure

- Create `agent-browser/src/features/harness-ui/types.ts`
  - Owns JSON-safe spec, element, widget, grid position/size, and edit patch types.
- Create `agent-browser/src/features/harness-ui/spaceLayout.ts`
  - Space-Agent-inspired grid normalization, collision checks, centered first-fit packing, and new widget placement.
- Create `agent-browser/src/features/harness-ui/harnessSpec.ts`
  - Builds the default full-app spec, lists editable elements, applies element patches, and creates compact prompt-context rows.
- Create `agent-browser/src/features/harness-ui/HarnessJsonRenderer.tsx`
  - Registry-backed renderer for the Agent Browser catalog. Start small and json-render-compatible; swap to `@json-render/react` after React/package compatibility is proven.
- Create `agent-browser/src/features/harness-ui/HarnessDashboardPanel.tsx`
  - Default infinite-canvas/dashboard panel with widget shell controls, add-widget affordance, and generated/spec widgets.
- Create `agent-browser/src/features/harness-ui/*.test.ts(x)`
  - Focused red/green tests for layout, spec editing, and dashboard rendering.
- Modify `agent-browser/src/services/workspaceTree.ts`
  - Add dashboard open state to the workspace view, panel id helpers, and default to dashboard first.
- Modify `agent-browser/src/services/sessionState.ts`
  - Validate persisted dashboard open state and persisted harness specs.
- Modify `agent-browser/src/App.tsx`
  - Add `DashboardPanel`, render it as the default active pane, pass workspace/session/browser data into the dashboard widget context, and keep existing panels available as spec-backed components.
- Modify `agent-browser/src/App.css`
  - Add responsive canvas, widget card, edit affordance, and stable grid sizing styles.
- Use `npm run visual:agent-browser`
  - Capture the default harness dashboard screenshot for PR evidence and copy the clean artifact into `agent-browser/docs/screenshots/harness-dashboard-default.png`.
- Add/update `agent-browser/docs/screenshots/*`
  - Keep research and final visual screenshots checked in.

## Phase 1: Harness Spec And Space Layout Foundation

**Files:**
- Create: `agent-browser/src/features/harness-ui/types.ts`
- Create: `agent-browser/src/features/harness-ui/spaceLayout.ts`
- Create: `agent-browser/src/features/harness-ui/harnessSpec.ts`
- Test: `agent-browser/src/features/harness-ui/spaceLayout.test.ts`
- Test: `agent-browser/src/features/harness-ui/harnessSpec.test.ts`

- [x] **Step 1: Write failing layout tests**

```ts
it('packs widgets around the centered origin without overlap', () => {
  const layout = buildCenteredFirstFitLayout({
    viewportCols: 12,
    widgetIds: ['a', 'b', 'c'],
    widgetSizes: {
      a: { cols: 6, rows: 3 },
      b: { cols: 4, rows: 2 },
      c: { cols: 4, rows: 2 },
    },
  });
  expect(layout.positions).toEqual({
    a: { col: -5, row: -2 },
    b: { col: 1, row: -2 },
    c: { col: 1, row: 0 },
  });
});
```

- [x] **Step 2: Run layout tests and verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/features/harness-ui/spaceLayout.test.ts`

Expected: FAIL because `spaceLayout.ts` does not exist.

- [x] **Step 3: Implement layout helpers**

Implement Space Agent parity helpers: `normalizeWidgetSize`, `normalizeWidgetPosition`, `resolveSpaceLayout`, `buildCenteredFirstFitLayout`, and `findFirstFitWidgetPlacement`.

- [x] **Step 4: Verify layout GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/features/harness-ui/spaceLayout.test.ts`

Expected: PASS.

- [x] **Step 5: Write failing harness spec tests**

Tests must assert:
- default app spec root is `HarnessShell`
- every element is editable unless explicitly locked
- dashboard is the first default main surface
- patching an element is immutable and rejects unknown ids
- prompt context rows use `id|type|title|editable|slot`

- [x] **Step 6: Implement harness spec helpers and verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/features/harness-ui/harnessSpec.test.ts`

Expected: PASS.

## Phase 2: Default Dashboard/Infinite Canvas

**Files:**
- Create: `agent-browser/src/features/harness-ui/HarnessJsonRenderer.tsx`
- Create: `agent-browser/src/features/harness-ui/HarnessDashboardPanel.tsx`
- Test: `agent-browser/src/features/harness-ui/HarnessDashboardPanel.test.tsx`
- Modify: `agent-browser/src/App.css`

- [x] **Step 1: Write failing dashboard component tests**

Assert the rendered default dashboard shows:
- `Harness dashboard` region
- editable widgets for workspace summary, active sessions, browser pages, files, and agent actions
- add-widget prompt card matching json-render demo requirements
- no nested card-inside-card generated widget chrome

- [x] **Step 2: Implement renderer and panel**

Start with a local json-render-compatible renderer over `{ root, elements }` specs, plus explicit catalog mappings for `Stack`, `Metric`, `ActionList`, `WorkspaceSummary`, `SessionList`, `BrowserPageList`, and `FileList`.

- [x] **Step 3: Verify component GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/features/harness-ui/HarnessDashboardPanel.test.tsx`

Expected: PASS.

## Phase 3: Dashboard As Default App View

**Files:**
- Modify: `agent-browser/src/services/workspaceTree.ts`
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.test.tsx`
- Modify: `agent-browser/tests/app.spec.ts`

- [x] **Step 1: Write failing workspace-state tests**

Assert new workspaces default to `dashboardOpen: true` and preserve existing browser/session/file panels.

- [x] **Step 2: Implement workspace-state support**

Add `dashboardOpen`, `dashboard:<workspaceId>` pane ids, validation, equality, and normalization.

- [x] **Step 3: Write failing app tests**

Assert fresh app launch shows the harness dashboard by default and opening a session/browser/file adds panes beside it instead of replacing it.

- [x] **Step 4: Implement App integration**

Add `DashboardPanel` to `Panel`, include it first in `panelEntries`, and close/reopen it via state.

- [x] **Step 5: Add Playwright screenshot evidence**

Capture `output/playwright/agent-browser-visual-smoke.png` through `npm run visual:agent-browser` and keep a clean copy at `agent-browser/docs/screenshots/harness-dashboard-default.png`.

## Phase 4: Whole Harness As Editable Widgets

**Files:**
- Modify/create component adapters under `agent-browser/src/features/harness-ui/catalog/`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/services/workspaceMcpWorktree.ts`

- [x] Convert top-level app chrome to spec nodes: activity rail, omnibar, sidebar, content area, toast host.
- [x] Convert workspace tree sections to editable catalog components.
- [x] Convert chat/session panel shell to editable catalog components while keeping message runtime internal.
- [x] Convert browser/page panel, file editor, settings, model registry, history, extensions, account, toast, modal, and context-menu surfaces to catalog components.
- [x] Add an element inspector/editor that can patch safe props, invoke natural-language regeneration, and restore the default harness.

## Phase 5: Agent-Driven Widget Generation And Editing

**Files:**
- Modify: `agent-browser-mcp` workspace tools as needed
- Modify: `agent-browser/src/tools`
- Modify: `agent-browser/src/features/harness-ui/harnessSpec.ts`

- [x] Add WebMCP tools/actions to list editable app elements, read a selected element spec, patch a selected element, create dashboard widgets through regeneration, regenerate the harness, and restore defaults.
- [x] Add compact transient context for current app spec and dashboard widgets.
- [x] Add app-level regression coverage for WebMCP harness customization and persisted generated specs.

## Phase 6: Parity Hardening

- [x] Persist specs per workspace with validation and invalid-spec fallback.
- [x] Keep the app spec json-render-compatible while preserving Agent Browser design-system tokens and catalog constraints.
- [x] Keep MCP Apps and AG-UI as future import/event bridges after the in-app spec/action model is stable.
- [x] Add visual screenshot evidence for the default generated dashboard and customization entry point.
- [x] Keep `npm run verify:agent-browser` green after the implementation batch.

## Acceptance Gates

- Focused unit/component tests pass for each phase.
- `npm.cmd --workspace agent-browser run test:coverage` remains clean for touched source.
- `npm run visual:agent-browser` captures the default dashboard.
- `npm run verify:agent-browser` passes from repo root.
- Final PR description includes screenshots for Space Agent/json-render research and the implemented Agent Browser dashboard/customization flow.
