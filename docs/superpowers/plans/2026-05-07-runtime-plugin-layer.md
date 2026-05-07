# Runtime Plugin Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Agent Browser runtime plugin layer that can register extension capabilities, publish lifecycle events, and apply auditable tool-call interception policy.

**Architecture:** Implement a deterministic `runtimePlugins` service that compiles plugin manifests and operator settings into a runtime summary, event subscriptions, provider/tool registrations, and interception decisions. Persist settings through `sessionState.ts`, surface controls in the existing Settings panel, inject runtime context into chat/tool prompts, and add visual-smoke assertions for the configuration surface.

**Tech Stack:** React 18, TypeScript, Vitest, Vite, `useStoredState`, Agent Browser Settings/Process panels, Playwright visual smoke.

---

## Feature Implementation Plan

TK-55 asks for a reusable browser-agent plugin runtime. The first delivery slice should be narrow but end-to-end:

1. Define a stable plugin manifest/settings model for runtime extensions.
2. Compile repo/user plugin manifests into runtime registrations for tools, providers, hooks, shell environment, and compaction hints.
3. Evaluate tool-call interception before execution with an auditable `allow | rewrite | block` decision.
4. Persist the operator policy and expose it in Settings.
5. Inject active plugin policy into the agent prompt and show the state in the app chrome.
6. Cover the service, persistence guard, App smoke behavior, script regression, and visual-smoke Settings path.

Non-goals for this slice:

- Loading arbitrary remote code.
- Executing plugin-provided JavaScript.
- Building a marketplace installer.
- Replacing existing extension discovery.

## Technical Spec

### Data Model

Create `agent-browser/src/services/runtimePlugins.ts`.

```ts
export type RuntimePluginEventKind =
  | 'session:start'
  | 'permission:request'
  | 'message:received'
  | 'tool:before-call'
  | 'tool:after-call'
  | 'file:changed'
  | 'diagnostic:reported';

export type RuntimePluginInterceptionMode = 'observe' | 'rewrite' | 'block';

export interface RuntimePluginSettings {
  enabled: boolean;
  defaultInterceptionMode: RuntimePluginInterceptionMode;
  requireRationale: boolean;
  enabledPluginIds: string[];
  blockedToolIds: string[];
  rewriteRules: string[];
}
```

Plugin manifests stay data-only and deterministic:

```ts
export interface RuntimePluginManifest {
  id: string;
  name: string;
  description: string;
  source: 'repo' | 'user' | 'workspace';
  tools: RuntimePluginToolRegistration[];
  providers: RuntimePluginProviderRegistration[];
  eventSubscriptions: RuntimePluginEventKind[];
  interceptsToolCalls: boolean;
  shellEnvironment: Record<string, string>;
  compactionHint?: string;
}
```

### Runtime Compilation

`buildRuntimePluginRuntime({ settings, manifests, selectedToolIds })` returns:

- normalized settings
- active plugins
- registered tool/provider summaries
- event subscriptions grouped by event kind
- shell environment entries
- compaction hints
- policy summary cards for UI/prompt display

Disabled runtimes return zero active plugins and a prompt context explaining runtime plugins are off.

### Tool Interception

`evaluateRuntimePluginToolCall({ runtime, toolCall })` returns:

- `allow` when no active policy matches
- `rewrite` when a rewrite rule maps `toolId:arg=value`
- `block` when a tool is explicitly blocked or a plugin with `interceptsToolCalls` is active and strict block mode is configured

Every non-allow result includes an audit entry with plugin id, rationale, original tool id, and rewritten args when applicable.

### App Integration

Modify `agent-browser/src/App.tsx`:

- import service types/defaults
- persist `runtimePluginSettings` with `useStoredState`
- build runtime from built-in manifests and selected tool IDs
- add `plugins ${activePluginCount}/${manifestCount}` to the context summary
- append `buildRuntimePluginPromptContext(runtime)` to `requestWorkspacePromptContext`
- render `RuntimePluginSettingsPanel` in Settings near partner/adversary controls
- show active tool/provider/hook counts and active policy mode

### Persistence

Modify `agent-browser/src/services/sessionState.ts`:

- add `runtimePluginSettings: 'agent-browser.runtime-plugin-settings'`
- add tests for loading valid settings and rejecting malformed payloads

### Visual Validation

Modify `agent-browser/scripts/visual-smoke.mjs`:

- open Settings
- expand "Runtime plugins"
- assert enable checkbox, interception mode, and active plugin summary are visible
- screenshot through the existing smoke output path

## One-Shot LLM Prompt

You are implementing Linear TK-55 in `agent-browser`. Add a deterministic runtime plugin layer that uses existing Agent Browser architecture instead of arbitrary plugin code execution.

Implement `agent-browser/src/services/runtimePlugins.ts` with typed plugin manifests, persisted settings validation, runtime compilation, prompt context generation, and auditable tool-call interception decisions. Add tests in `agent-browser/src/services/runtimePlugins.test.ts` before implementation. Extend `agent-browser/src/services/sessionState.ts` and its tests with a new `STORAGE_KEYS.runtimePluginSettings` key. Wire the runtime into `agent-browser/src/App.tsx` using `useStoredState`, show the controls in Settings, include plugin counts in the context summary, and append runtime plugin context to `requestWorkspacePromptContext`. Add App smoke and visual-smoke coverage for the Settings surface.

Use TDD. Keep the runtime data-only: no remote code loading, no `eval`, no dynamic imports. Treat plugins as manifests that register tools/providers/hooks, shell environment entries, compaction hints, and interception policy. Validate with focused service tests, script tests, lint/build where available, `npm.cmd run visual:agent-browser`, and the full `npm.cmd run verify:agent-browser`.

## File Structure

- Create: `agent-browser/src/services/runtimePlugins.ts` - pure runtime-plugin model, settings validator, runtime builder, prompt context builder, tool-call evaluator.
- Create: `agent-browser/src/services/runtimePlugins.test.ts` - service coverage for settings validation, runtime building, prompt context, rewrite/block decisions.
- Modify: `agent-browser/src/services/sessionState.ts` - storage key for persisted settings.
- Modify: `agent-browser/src/services/sessionState.test.ts` - storage-key guard for runtime plugin settings.
- Modify: `agent-browser/src/App.tsx` - persisted state, prompt context wiring, Settings UI, context summary.
- Modify: `agent-browser/src/App.smoke.test.tsx` - smoke assertion for Runtime plugins Settings controls.
- Modify: `agent-browser/src/App.css` - compact responsive Settings cards.
- Modify: `agent-browser/scripts/visual-smoke.mjs` - Settings assertions for runtime plugins.
- Modify: `agent-browser/scripts/run-script-tests.mjs` - script regression assertion if visual smoke text checks are covered there.

## TDD Task Plan

### Task 1: Runtime Plugin Service

**Files:**
- Create: `agent-browser/src/services/runtimePlugins.test.ts`
- Create: `agent-browser/src/services/runtimePlugins.ts`

- [ ] **Step 1: Write failing service tests**

```ts
import { describe, expect, test } from 'vitest';
import {
  DEFAULT_RUNTIME_PLUGIN_SETTINGS,
  buildRuntimePluginPromptContext,
  buildRuntimePluginRuntime,
  evaluateRuntimePluginToolCall,
  isRuntimePluginSettings,
} from './runtimePlugins';

describe('runtimePlugins', () => {
  test('builds an active runtime from enabled plugin manifests', () => {
    const runtime = buildRuntimePluginRuntime({
      settings: {
        ...DEFAULT_RUNTIME_PLUGIN_SETTINGS,
        enabledPluginIds: ['repo-policy'],
      },
      manifests: [{
        id: 'repo-policy',
        name: 'Repo policy',
        description: 'Policy hooks',
        source: 'repo',
        tools: [{ id: 'policy.scan', name: 'Policy scan', description: 'Scan policy' }],
        providers: [{ id: 'policy-provider', name: 'Policy Provider', kind: 'auth' }],
        eventSubscriptions: ['tool:before-call', 'diagnostic:reported'],
        interceptsToolCalls: true,
        shellEnvironment: { AGENT_POLICY: 'strict' },
        compactionHint: 'Keep policy audit ids.',
      }],
      selectedToolIds: ['read-file'],
    });

    expect(runtime.activePluginCount).toBe(1);
    expect(runtime.toolRegistrations).toHaveLength(1);
    expect(runtime.providerRegistrations).toHaveLength(1);
    expect(runtime.eventSubscriptions['tool:before-call']).toEqual(['repo-policy']);
    expect(runtime.shellEnvironment.AGENT_POLICY).toBe('strict');
  });

  test('blocks configured risky tools with an audit rationale', () => {
    const runtime = buildRuntimePluginRuntime({
      settings: {
        ...DEFAULT_RUNTIME_PLUGIN_SETTINGS,
        enabledPluginIds: ['repo-policy'],
        blockedToolIds: ['shell.exec'],
      },
      manifests: [{
        id: 'repo-policy',
        name: 'Repo policy',
        description: 'Policy hooks',
        source: 'repo',
        tools: [],
        providers: [],
        eventSubscriptions: ['tool:before-call'],
        interceptsToolCalls: true,
        shellEnvironment: {},
      }],
      selectedToolIds: ['shell.exec'],
    });

    const decision = evaluateRuntimePluginToolCall({
      runtime,
      toolCall: { id: 'call-1', toolId: 'shell.exec', args: { command: 'rm -rf dist' } },
    });

    expect(decision.decision).toBe('block');
    expect(decision.auditEntry?.pluginId).toBe('repo-policy');
    expect(decision.auditEntry?.rationale).toContain('shell.exec');
  });

  test('rewrites arguments through explicit rewrite rules', () => {
    const runtime = buildRuntimePluginRuntime({
      settings: {
        ...DEFAULT_RUNTIME_PLUGIN_SETTINGS,
        defaultInterceptionMode: 'rewrite',
        enabledPluginIds: ['repo-policy'],
        rewriteRules: ['shell.exec:command=npm.cmd run verify:agent-browser'],
      },
      manifests: [{
        id: 'repo-policy',
        name: 'Repo policy',
        description: 'Policy hooks',
        source: 'repo',
        tools: [],
        providers: [],
        eventSubscriptions: ['tool:before-call'],
        interceptsToolCalls: true,
        shellEnvironment: {},
      }],
      selectedToolIds: ['shell.exec'],
    });

    const decision = evaluateRuntimePluginToolCall({
      runtime,
      toolCall: { id: 'call-2', toolId: 'shell.exec', args: { command: 'npm run verify:agent-browser' } },
    });

    expect(decision.decision).toBe('rewrite');
    expect(decision.rewrittenArgs).toEqual({ command: 'npm.cmd run verify:agent-browser' });
  });

  test('validates persisted settings shape', () => {
    expect(isRuntimePluginSettings(DEFAULT_RUNTIME_PLUGIN_SETTINGS)).toBe(true);
    expect(isRuntimePluginSettings({ enabled: true, enabledPluginIds: [2] })).toBe(false);
  });

  test('builds prompt context for active runtime policy', () => {
    const runtime = buildRuntimePluginRuntime({
      settings: DEFAULT_RUNTIME_PLUGIN_SETTINGS,
      manifests: [],
      selectedToolIds: [],
    });

    expect(buildRuntimePluginPromptContext(runtime)).toContain('Runtime plugin policy');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test -- src/services/runtimePlugins.test.ts`

Expected: FAIL because `./runtimePlugins` does not exist.

- [ ] **Step 3: Implement minimal runtime service**

Create the exported types/functions used by the tests. Keep all parsing deterministic and data-only.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd --workspace agent-browser run test -- src/services/runtimePlugins.test.ts`

Expected: PASS.

### Task 2: Persistence Guard

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/services/sessionState.test.ts`

- [ ] **Step 1: Write failing session-state test**

Add an assertion that `STORAGE_KEYS.runtimePluginSettings` equals `agent-browser.runtime-plugin-settings` and that malformed runtime plugin settings fall back through `useStoredState` validation.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test -- src/services/sessionState.test.ts`

Expected: FAIL because the storage key is missing.

- [ ] **Step 3: Add storage key and validator wiring**

Add the key in the localStorage section and import/use `isRuntimePluginSettings` from the new service where needed.

- [ ] **Step 4: Run session-state tests**

Run: `npm.cmd --workspace agent-browser run test -- src/services/sessionState.test.ts`

Expected: PASS.

### Task 3: App Wiring and Settings UI

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/src/App.smoke.test.tsx`

- [ ] **Step 1: Add failing App smoke assertion**

Assert Settings renders a "Runtime plugins" section with "Enable runtime plugins", "Tool-call interception mode", and an active plugin count.

- [ ] **Step 2: Run smoke test to verify failure**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx`

Expected: FAIL because the Settings section is absent.

- [ ] **Step 3: Wire state/runtime and render Settings section**

Use `useStoredState(localStorageBackend, STORAGE_KEYS.runtimePluginSettings, isRuntimePluginSettings, DEFAULT_RUNTIME_PLUGIN_SETTINGS)`. Build runtime from built-in data manifests and selected tool ids. Render controls with existing `SettingsSection`, `secret-settings-grid`, and compact card classes.

- [ ] **Step 4: Inject prompt context**

Append `buildRuntimePluginPromptContext(requestRuntimePluginRuntime)` to the request workspace prompt context and include runtime plugin counts in `contextSummary`.

- [ ] **Step 5: Run App smoke test**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx`

Expected: PASS.

### Task 4: Visual Smoke and Full Verification

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Modify: `agent-browser/scripts/run-script-tests.mjs`

- [ ] **Step 1: Add visual-smoke assertions**

Open Settings, expand "Runtime plugins", and assert the enable checkbox, interception mode, and "active plugins" summary are visible.

- [ ] **Step 2: Run script tests**

Run: `npm.cmd --workspace agent-browser run test:scripts`

Expected: PASS.

- [ ] **Step 3: Run visual smoke**

Run: `npm.cmd run visual:agent-browser`

Expected: PASS and write `output/playwright/agent-browser-visual-smoke.png`.

- [ ] **Step 4: Run full gate**

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`

Expected: PASS through generated-file checks, eval validation/tests, script tests, lint, coverage, build, audit, and visual smoke.

## Self-Review

- Spec coverage: manifest compilation, event subscriptions, provider/tool registration summaries, tool interception, persistence, Settings UI, prompt injection, and visual-smoke coverage are each mapped to a task.
- Placeholder scan: no task relies on TBD behavior or unspecified tests.
- Type consistency: all service names use the `RuntimePlugin*` prefix and exported functions match the test plan.
