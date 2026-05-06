# Partner Agent Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a policy-governed partner-agent control plane for Agent Browser so Codi, GHCP, Cursor, Codex, and specialist agents share one governance, audit, and model-selection surface.

**Architecture:** Keep the existing `AgentProvider` and per-session model selection contracts. Add a pure `partnerAgentControlPlane` service that derives provider readiness, model references, governance policy, audit rows, and prompt context from the current app state, then surface that service in Settings and chat execution.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, existing `agent-browser` services, `sessionState` storage helpers, and `visual:agent-browser` for viewport smoke coverage.

---

## Linear Source

Issue: TK-53, "Add a policy-governed partner-agent control plane and model picker"

Problem statement: `agent-browser` can run its own agent stack, but it lacks a shared control plane for switching or delegating across multiple agent backends while keeping one consistent policy, review, and audit model for browser-agent tasks.

Implementation intent: host multiple agent backends behind one session UX, unify permissions and audit logging, preserve issue, diff, and review workflow regardless of backend, and expose per-agent model selection without fragmenting run history or browser evidence.

## Files

- Create: `agent-browser/src/services/partnerAgentControlPlane.ts`
- Create: `agent-browser/src/services/partnerAgentControlPlane.test.ts`
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/src/App.smoke.test.tsx`
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Modify: `agent-browser/scripts/run-script-tests.mjs`

## Technical Spec

### Control Plane Model

`partnerAgentControlPlane.ts` owns these exported contracts:

- `PartnerAgentControlPlaneSettings`: `{ enabled, requirePolicyReview, preserveEvidence, auditLevel }`
- `DEFAULT_PARTNER_AGENT_CONTROL_PLANE_SETTINGS`
- `isPartnerAgentControlPlaneSettings(value)`
- `buildPartnerAgentControlPlane(input)`
- `createPartnerAgentAuditEntry(input)`
- `buildPartnerAgentPromptContext(controlPlane, auditEntry?)`

The control plane must derive one stable list of partner agents:

- Codi: provider `codi`, local/offline, ready when installed local models exist.
- GitHub Copilot: provider `ghcp`, partner/cloud, ready when Copilot is authenticated and has enabled models.
- Cursor: provider `cursor`, partner/cloud, ready when Cursor is authenticated and has enabled models.
- Codex: provider `codex`, partner/cli, ready when Codex is authenticated and has enabled models.
- Researcher, Debugger, Planner: specialist agents that route through model-backed providers and inherit the same control-plane policy.

Each model option must be represented as `provider:modelId` so picker and audit rows do not fragment by backend-specific storage keys.

### Policy Behavior

When enabled, the control plane prompt context must say:

- Partner agent control plane is active.
- Policy review, evidence preservation, and audit level are enabled/disabled according to settings.
- Current provider, runtime provider, model ref, ready agent count, and selected tool count.
- Issue, diff, review, browser evidence, and AgentBus traces are one shared workflow across all backends.

The context must be appended to `workspacePromptContext` before direct and tool-backed chat runs. This keeps the behavior backend-independent without changing each provider implementation.

### Audit Behavior

At send time, the app must create one audit entry with:

- `sessionId`
- selected logical provider
- resolved runtime provider
- `modelRef`
- selected tool IDs
- policy flags
- timestamp

The entry is included in the prompt context and shown in Settings as a latest-turn audit preview. It does not create a new durable run-history store in this iteration; persisted settings are durable, audit rows are session-local runtime evidence.

### UI Behavior

Settings gets a new collapsible "Partner agent control plane" section above benchmark routing. It must include:

- enable checkbox
- policy review checkbox
- evidence preservation checkbox
- audit level select (`minimal`, `standard`, `strict`)
- compact readiness list for Codi, GHCP, Cursor, Codex, Researcher, Debugger, Planner
- latest audit preview when available

The section should be dense, mobile-first, keyboard accessible, and use existing `SettingsSection`, `provider-card`, `badge`, and checkbox row styles.

## One-Shot LLM Prompt

You are implementing TK-53 in `C:\Users\conta\.codex\worktrees\dc8f\agent-harness`.

Add a policy-governed partner-agent control plane to Agent Browser. Use the existing Codi, GHCP, Cursor, Codex, Researcher, Debugger, and Planner provider architecture; do not add new `.agents/*/AGENTS.md` workspace agents. Create a pure TypeScript service at `agent-browser/src/services/partnerAgentControlPlane.ts` with default settings, validation, readiness/model derivation, audit-entry creation, and prompt-context rendering. Persist settings with `STORAGE_KEYS.partnerAgentControlPlaneSettings`. Render a new Settings section with accessible controls and a readiness/audit summary. Feed the control-plane prompt context into chat execution so direct, Codex, GHCP, Cursor, local Codi, and tool-backed runs all share the same policy/audit language. Add Vitest service tests first, then App smoke/visual-smoke assertions. Run focused tests, `npm.cmd run verify:agent-browser`, and copy the visual smoke screenshot into this plan directory for the PR.

## TDD Tasks

### Task 1: Pure Control Plane Service

**Files:**
- Create: `agent-browser/src/services/partnerAgentControlPlane.test.ts`
- Create: `agent-browser/src/services/partnerAgentControlPlane.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARTNER_AGENT_CONTROL_PLANE_SETTINGS,
  buildPartnerAgentControlPlane,
  buildPartnerAgentPromptContext,
  createPartnerAgentAuditEntry,
  isPartnerAgentControlPlaneSettings,
} from './partnerAgentControlPlane';

describe('partnerAgentControlPlane', () => {
  it('derives ready partner agents and stable provider model refs', () => {
    const plane = buildPartnerAgentControlPlane({
      settings: DEFAULT_PARTNER_AGENT_CONTROL_PLANE_SETTINGS,
      installedModels: [{ id: 'local-qwen', name: 'Local Qwen', status: 'installed' }],
      copilotState: { authenticated: true, models: [{ id: 'gpt-4.1', name: 'GPT-4.1' }] },
      cursorState: { authenticated: true, models: [{ id: 'composer-2', name: 'Composer 2' }] },
      codexState: { authenticated: true, models: [{ id: 'codex-default', name: 'Codex default' }] },
      selectedProvider: 'planner',
      runtimeProvider: 'ghcp',
      selectedModelRef: 'ghcp:gpt-4.1',
      selectedToolIds: ['read-file', 'write-file'],
    });

    expect(plane.readyAgentCount).toBeGreaterThanOrEqual(6);
    expect(plane.modelOptions.map((option) => option.ref)).toContain('codi:local-qwen');
    expect(plane.modelOptions.map((option) => option.ref)).toContain('ghcp:gpt-4.1');
    expect(plane.modelOptions.map((option) => option.ref)).toContain('cursor:composer-2');
    expect(plane.modelOptions.map((option) => option.ref)).toContain('codex:codex-default');
  });

  it('renders policy and audit prompt context without backend-specific fragmentation', () => {
    const plane = buildPartnerAgentControlPlane({
      settings: { enabled: true, requirePolicyReview: true, preserveEvidence: true, auditLevel: 'strict' },
      installedModels: [],
      copilotState: { authenticated: true, models: [{ id: 'gpt-4.1', name: 'GPT-4.1' }] },
      cursorState: { authenticated: false, models: [] },
      codexState: { authenticated: true, models: [{ id: 'codex-default', name: 'Codex default' }] },
      selectedProvider: 'codex',
      runtimeProvider: 'codex',
      selectedModelRef: 'codex:codex-default',
      selectedToolIds: [],
    });
    const audit = createPartnerAgentAuditEntry({ controlPlane: plane, sessionId: 'session-1' });

    expect(buildPartnerAgentPromptContext(plane, audit)).toContain('Partner agent control plane: enabled');
    expect(buildPartnerAgentPromptContext(plane, audit)).toContain('Unified workflow: issue, diff, review, browser evidence, and AgentBus traces stay attached to one session.');
    expect(audit.modelRef).toBe('codex:codex-default');
  });

  it('accepts only valid settings payloads', () => {
    expect(isPartnerAgentControlPlaneSettings(DEFAULT_PARTNER_AGENT_CONTROL_PLANE_SETTINGS)).toBe(true);
    expect(isPartnerAgentControlPlaneSettings({ enabled: true, requirePolicyReview: true, preserveEvidence: true, auditLevel: 'noisy' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/services/partnerAgentControlPlane.test.ts`

Expected: FAIL because `partnerAgentControlPlane` module does not exist.

- [ ] **Step 3: Implement service**

Implement the service with narrow types, deterministic ordering, stable `provider:modelId` refs, and total validators.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/services/partnerAgentControlPlane.test.ts`

Expected: PASS.

### Task 2: Persist Settings and Render Settings Surface

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.smoke.test.tsx`
- Modify: `agent-browser/src/App.css`

- [ ] **Step 1: Write failing smoke test**

Add a test that opens Settings, finds "Partner agent control plane", expands it, verifies the enable/policy/evidence controls, and toggles audit level to persist `agent-browser.partner-agent-control-plane-settings`.

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx`

Expected: FAIL because Settings does not render the new section.

- [ ] **Step 3: Implement storage and Settings UI**

Add `STORAGE_KEYS.partnerAgentControlPlaneSettings`, hydrate it in `App`, pass settings and control-plane state into `SettingsPanel`, and add `PartnerAgentControlPlaneSettingsPanel`.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx`

Expected: PASS.

### Task 3: Feed Audit Context Into Chat Runs

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.integration.test.tsx`

- [ ] **Step 1: Write failing integration test**

Extend an existing GHCP/Codex direct-run test to assert the prompt includes `Partner agent control plane: enabled` and the expected `modelRef`.

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.integration.test.tsx -t "partner agent control plane"`

Expected: FAIL because the prompt context has not been appended.

- [ ] **Step 3: Implement chat prompt integration**

Create the audit entry at send time, build prompt context, append it to `workspacePromptContext`, and store the latest audit entry in React state for Settings.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.integration.test.tsx -t "partner agent control plane"`

Expected: PASS.

### Task 4: Visual Smoke and Script Coverage

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Modify: `agent-browser/scripts/run-script-tests.mjs`

- [ ] **Step 1: Write failing script coverage**

Add `run-script-tests.mjs` assertions that `visual-smoke.mjs` checks "Partner agent control plane" and "Enable partner-agent control plane".

- [ ] **Step 2: Run script tests to verify RED**

Run: `npm.cmd --workspace agent-browser run test:scripts`

Expected: FAIL until visual smoke contains the new assertions.

- [ ] **Step 3: Update visual smoke**

Open Settings, expand the Partner Agent section, assert the new controls are visible, and keep the existing benchmark/adversary checks.

- [ ] **Step 4: Run script tests to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test:scripts`

Expected: PASS.

### Task 5: Full Verification and PR

- [ ] **Step 1: Run focused checks**

Run:

```powershell
npm.cmd --workspace agent-browser run test -- src/services/partnerAgentControlPlane.test.ts
npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx
npm.cmd --workspace agent-browser run test:app -- src/App.integration.test.tsx -t "partner agent control plane"
npm.cmd --workspace agent-browser run test:scripts
```

- [ ] **Step 2: Run full Agent Browser verifier**

Run: `npm.cmd run verify:agent-browser`

Expected: generated-file check, eval validation/tests, script tests, lint, coverage, build, audit, and visual smoke pass.

- [ ] **Step 3: Copy visual evidence**

Copy `output/playwright/agent-browser-visual-smoke.png` to `docs/superpowers/plans/2026-05-06-partner-agent-control-plane-visual-smoke.png`.

- [ ] **Step 4: Publish**

Create branch `codex/tk-53-partner-agent-control-plane`, commit, push, open PR, label `codex` and `codex-automation`, link the PR to TK-53, and move TK-53 to Done after successful verification.

## Self-Review

Spec coverage: The service covers shared backend inventory, policy settings, model refs, and audit prompt context. The UI covers operator control and readiness. The chat integration keeps issue/diff/review/browser evidence attached to the existing session by prompt policy rather than introducing a parallel run store.

Placeholder scan: No task relies on TBD or later implementation. Each task has explicit files, commands, and expected behavior.

Type consistency: The plan uses `PartnerAgentControlPlaneSettings`, `PartnerAgentAuditEntry`, `AgentProvider`, `ModelBackedAgentProvider`, and `provider:modelId` consistently across service, storage, UI, and tests.
