# Versioned Workspace Skill Policies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Agent Browser visibility and prompt enforcement for versioned workspace skill packages with least-privilege tool, path, external-path, and helper scopes.

**Architecture:** Implement the feature as a pure `agent-browser/src/services/workspaceSkillPolicies.ts` domain service, persist settings through `sessionState.ts`, surface controls in the existing Settings panel, and inject the resulting policy context into chat prompts. Browser-visible evidence is covered by App smoke tests and `visual-smoke.mjs`.

**Tech Stack:** React 18, TypeScript, Vitest, localStorage-backed `useStoredState`, existing Settings/visual-smoke patterns.

---

## Linear Source

Issue: TK-42, "Add versioned workspace skills and least-privilege policies"

Why now: Mastra treats skills and workspace permissions as durable governed assets, while Agent Browser currently has coarse-grained policy seams and weak lifecycle management for reusable workflow assets.

Problem: Agent Browser skills and workspace access rules are not managed as versioned, inspectable, publishable assets with clear least-privilege boundaries.

Implementation target: Versioned workspace skill packages, draft-to-publish lifecycle, per-skill tool/path scopes, explicit allowlisted external paths, and searchable workspace helpers such as regex grep that respect those boundaries.

## Feature Implementation Plan

1. Add a pure workspace skill policy service that defines package metadata, lifecycle state, least-privilege scopes, helper availability, prompt context, validators, and policy-aware regex search.
2. Persist the policy state under a new `agent-browser.workspace-skill-policy-state` key.
3. Add Settings UI that shows draft/published package counts, scoped tools, path/external allowlists, helper status, and a publish action for draft packages.
4. Inject policy context into the active chat prompt so agents see the allowed skill/package boundaries before tool use.
5. Extend smoke/script/visual coverage so the Settings surface and screenshot evidence cover the new governance controls.

## Architecture-Aligned Technical Spec

### Data Model

`WorkspaceSkillPackage` captures:
- `id`, `name`, `version`, `status`, `description`
- `toolScopes`: allowed tool IDs
- `pathScopes`: repository-relative path scopes, including `/**` prefixes
- `externalPaths`: explicit absolute or workspace-external allowlists
- timestamps for `updatedAt` and optional `publishedAt`

`WorkspaceSkillPolicyState` captures:
- `enabled`
- `enforceLeastPrivilege`
- `packages`
- `helpers`, starting with policy-aware regex grep

### Runtime Behavior

`buildWorkspaceSkillPolicyInventory(state)` derives counts, package rows, helper rows, warnings, and stable prompt lines.

`publishWorkspaceSkillDraft(state, packageId, now)` transitions only draft packages to `published`, stamps `publishedAt`, and returns an immutable next state.

`searchWorkspaceFilesWithinPolicy(files, query, package)` performs regex search only against files whose paths are allowed by the package path scopes.

`buildWorkspaceSkillPolicyPromptContext(inventory)` returns an empty string when disabled and otherwise emits a concise policy section for chat agents.

### UI Behavior

The Settings panel adds "Workspace skill policies" using existing `SettingsSection`, checkbox rows, compact cards, and badges. It must be usable at mobile widths and not introduce nested cards.

### Persistence

Add `workspaceSkillPolicyState` to `STORAGE_KEYS` and session-state tests. Use `useStoredState(localStorageBackend, STORAGE_KEYS.workspaceSkillPolicyState, isWorkspaceSkillPolicyState, DEFAULT_WORKSPACE_SKILL_POLICY_STATE)`.

### Visual Evidence

Extend `visual-smoke.mjs` to open Settings, assert "Workspace skill policies", "Least-privilege enforcement", and "Policy-aware regex grep", then write the normal screenshot. Copy passing evidence to `docs/superpowers/plans/2026-05-06-versioned-workspace-skill-policies-visual-smoke.png` before PR.

## One-Shot LLM Prompt

You are implementing Linear TK-42 in `agent-browser`.

Create `agent-browser/src/services/workspaceSkillPolicies.ts` and tests. Model versioned workspace skill packages with draft/published lifecycle, least-privilege tool scopes, repository path scopes, explicit external path allowlists, and a policy-aware regex grep helper. Export defaults, validators, immutable publish/update helpers, policy-aware file search, inventory derivation, and prompt context generation.

Wire the state into `agent-browser/src/services/sessionState.ts`, `agent-browser/src/App.tsx`, `agent-browser/src/App.css`, `agent-browser/src/App.smoke.test.tsx`, `agent-browser/scripts/run-script-tests.mjs`, and `agent-browser/scripts/visual-smoke.mjs`. Use existing Settings panel patterns. The Settings UI must show package lifecycle, allowed tools, allowed paths, external allowlists, helper status, and a draft publish button. Inject policy context into outgoing workspace prompt context.

Use TDD: write failing tests first, verify they fail, then implement. Run focused tests, `npm.cmd --workspace agent-browser run test:scripts`, `npm.cmd run visual:agent-browser`, and `npm.cmd run verify:agent-browser`. Save screenshot evidence and open a PR with `codex` and `codex-automation` labels.

## TDD Task Plan

### Task 1: Policy Service

**Files:**
- Create: `agent-browser/src/services/workspaceSkillPolicies.ts`
- Create: `agent-browser/src/services/workspaceSkillPolicies.test.ts`

- [ ] Step 1: Write failing tests for default package inventory, validators, draft publishing, prompt context, path/tool checks, and regex search respecting path scopes.
- [ ] Step 2: Run `npm.cmd --workspace agent-browser run test -- src/services/workspaceSkillPolicies.test.ts` and confirm failures are due to the missing service.
- [ ] Step 3: Implement the minimal service and types.
- [ ] Step 4: Rerun the focused test and confirm it passes.

### Task 2: Persistence

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/services/sessionState.test.ts`

- [ ] Step 1: Add a failing assertion for `workspaceSkillPolicyState` under `STORAGE_KEYS`.
- [ ] Step 2: Run the session-state test and confirm the missing key failure.
- [ ] Step 3: Add the storage key.
- [ ] Step 4: Rerun the focused tests.

### Task 3: Settings UI And Prompt Context

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/src/App.smoke.test.tsx`

- [ ] Step 1: Add failing smoke coverage for the Settings section and publish action.
- [ ] Step 2: Run the App smoke test and confirm the section is missing.
- [ ] Step 3: Wire persisted state, inventory derivation, prompt context, and Settings controls.
- [ ] Step 4: Rerun smoke coverage and fix accessibility or layout regressions.

### Task 4: Script And Visual Coverage

**Files:**
- Modify: `agent-browser/scripts/run-script-tests.mjs`
- Modify: `agent-browser/scripts/visual-smoke.mjs`

- [ ] Step 1: Add failing script assertions for the visual smoke strings and screenshot path expectations.
- [ ] Step 2: Run `npm.cmd --workspace agent-browser run test:scripts` and confirm failure.
- [ ] Step 3: Add visual smoke assertions for the new Settings surface.
- [ ] Step 4: Run script tests and `npm.cmd run visual:agent-browser`.

### Task 5: Verification And Publication

**Files:**
- Add: `docs/superpowers/plans/2026-05-06-versioned-workspace-skill-policies-visual-smoke.png`

- [ ] Step 1: Run focused service/App tests.
- [ ] Step 2: Run `npm.cmd --workspace agent-browser run test:scripts`.
- [ ] Step 3: Run `npm.cmd run verify:agent-browser`.
- [ ] Step 4: Commit with `scripts/codex-git.ps1`, push, open PR, add `codex` and `codex-automation` labels, attach screenshot evidence, update Linear, and move TK-42 to Done.

## Self-Review

Spec coverage: The plan covers versioned packages, draft publish lifecycle, tool/path scopes, external allowlists, regex grep helper, Settings visibility, prompt context, persistence, visual evidence, and PR publication.

Placeholder scan: No TBD/TODO/fill-in placeholders remain.

Type consistency: `WorkspaceSkillPolicyState`, `WorkspaceSkillPackage`, `buildWorkspaceSkillPolicyInventory`, `publishWorkspaceSkillDraft`, `searchWorkspaceFilesWithinPolicy`, and `buildWorkspaceSkillPolicyPromptContext` are the stable service API names used throughout the plan.
