# Shared Workspace Agents Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-class shared-agent registry in Agent Browser so teams can publish, version, permission, discover, audit, and measure reusable browser agents.

**Architecture:** Add a deterministic `sharedAgents` service that owns registry state, policy validation, derived catalog rows, prompt context, audit entries, and usage analytics. Persist the registry through `sessionState`, render it in Settings beside workspace skill policies and partner-agent governance, and inject the enabled governance summary into chat prompt context.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Vite visual smoke, existing Agent Browser localStorage persistence.

---

## Linear Source

Issue: TK-24 Publish shared workspace agents with governance

Problem: Teams need reusable browser-capable agents with ownership, permissions, and visibility, not just personal prompts.

Desired outcome: Implement shared agents that can be published, versioned, permissioned, and discovered by a team; include RBAC, audit visibility, and usage analytics.

## Feature Implementation Plan

1. Create a local, backend-free shared-agent registry state that can seed published and draft browser agents.
2. Validate role-based access controls for viewer, editor, publisher, and admin users.
3. Derive a discoverable catalog with published agent count, draft count, policy warnings, usage totals, and latest audit entry.
4. Add an explicit publish action that turns a draft into a versioned published shared agent and emits an audit entry.
5. Add a Settings section for shared agents with toggles for registry enablement, publish approval, audit visibility, and usage analytics.
6. Add prompt context so chat agents know which shared agents are governed, published, and available.
7. Add unit, App smoke, script, and visual-smoke coverage.

## Technical Spec

### Data Model

`SharedAgentRegistryState`

- `enabled: boolean`
- `requirePublishApproval: boolean`
- `showAuditTrail: boolean`
- `trackUsageAnalytics: boolean`
- `agents: SharedAgentDefinition[]`
- `audit: SharedAgentAuditEntry[]`
- `usage: SharedAgentUsageEvent[]`

`SharedAgentDefinition`

- `id`, `name`, `description`, `version`, `status`
- `owner`, `visibility`, `allowedRoles`
- `sourceProvider`, `capabilities`, `toolScopes`
- `updatedAt`, `publishedAt`

Validation rejects agents without a stable id/name/version/status/owner and rejects roles outside `viewer | editor | publisher | admin`.

### Service Responsibilities

`agent-browser/src/services/sharedAgents.ts`

- Export defaults with one published reviewer agent and one draft release agent.
- Export `isSharedAgentRegistryState` for durable storage validation.
- Export `buildSharedAgentCatalog(state)` to compute counts, catalog rows, warnings, audit visibility, and usage totals.
- Export `publishSharedAgentDraft(state, agentId, actor, now)` to publish a draft, bump status, preserve version, and prepend an audit event.
- Export `recordSharedAgentUsage(state, agentId, sessionId, actor, now)` to append bounded usage analytics.
- Export `buildSharedAgentPromptContext(catalog)` to provide chat context only when enabled.

### App Integration

`agent-browser/src/services/sessionState.ts`

- Add `sharedAgentRegistryState: 'agent-browser.shared-agent-registry-state'`.

`agent-browser/src/App.tsx`

- Import shared-agent service exports.
- Hydrate `sharedAgentRegistryState` via `useStoredState`.
- Build `sharedAgentCatalog` with `useMemo`.
- Pass `sharedAgentCatalog` and state setters into `SettingsPanel`.
- Render `SharedAgentsSettingsPanel` after workspace skill policies.
- Include `buildSharedAgentPromptContext(sharedAgentCatalog)` in `workspacePromptContext`.

`agent-browser/src/App.css`

- Reuse compact provider-card/list patterns and add small grid rules for shared-agent cards and metrics.
- Keep mobile layout single column.

### Testing

- Unit tests prove validation, catalog derivation, publishing audit entries, usage analytics, and prompt context.
- App smoke test proves the Settings section opens, exposes controls, lists published/draft shared agents, and publishes a draft.
- Visual smoke seeds the registry and checks Settings content.
- Final gate is `npm.cmd run verify:agent-browser`.

## One-Shot LLM Prompt

You are implementing Linear TK-24 in `C:\Users\conta\.codex\worktrees\5087\agent-harness`. Use TDD. Add a deterministic Agent Browser shared-agent registry for team-published browser agents with RBAC, audit visibility, and usage analytics. Implement `agent-browser/src/services/sharedAgents.ts` plus tests first. Persist registry state in `sessionState.ts`, render a `Shared agents` Settings panel in `App.tsx`, inject shared-agent prompt context into chat sessions, add CSS for responsive cards, extend `App.smoke.test.tsx`, and add visual-smoke assertions. Follow existing Settings patterns near workspace skill policies, partner-agent control plane, and runtime plugins. Validate with focused tests, script tests, visual smoke, and `npm.cmd run verify:agent-browser`. Include the visual screenshot in PR evidence.

## TDD Task Plan

### Task 1: Shared Agent Service

**Files:**
- Create: `agent-browser/src/services/sharedAgents.ts`
- Create: `agent-browser/src/services/sharedAgents.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for default catalog counts, invalid role rejection, draft publishing, bounded usage analytics, and prompt context.

- [ ] **Step 2: Run red test**

Run: `npm.cmd --workspace agent-browser run test -- agent-browser/src/services/sharedAgents.test.ts`
Expected: FAIL because `./sharedAgents` does not exist.

- [ ] **Step 3: Implement service**

Add exported types, defaults, validators, catalog builder, publish helper, usage helper, and prompt-context builder.

- [ ] **Step 4: Run green test**

Run: `npm.cmd --workspace agent-browser run test -- agent-browser/src/services/sharedAgents.test.ts`
Expected: PASS.

### Task 2: Persistence And Settings UI

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/src/App.smoke.test.tsx`

- [ ] **Step 1: Write failing App smoke test**

Add a test that opens Settings, expands `Shared agents`, verifies controls and seeded agents, clicks `Publish Release coordinator draft`, and sees a published status.

- [ ] **Step 2: Run red test**

Run: `npm.cmd --workspace agent-browser run test:app -- agent-browser/src/App.smoke.test.tsx`
Expected: FAIL because the Shared agents section is not rendered.

- [ ] **Step 3: Implement app wiring**

Persist registry state, build catalog, render the Settings panel, and include prompt context in chat workspace context.

- [ ] **Step 4: Run green App test**

Run: `npm.cmd --workspace agent-browser run test:app -- agent-browser/src/App.smoke.test.tsx`
Expected: PASS.

### Task 3: Visual Smoke And Verification

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Modify: `docs/superpowers/plans/2026-05-07-shared-workspace-agents-governance.md`

- [ ] **Step 1: Add visual assertions**

Seed shared-agent registry localStorage, open Settings, expand `Shared agents`, assert registry metrics and agent cards, screenshot full page.

- [ ] **Step 2: Run visual smoke**

Run: `npm.cmd run visual:agent-browser`
Expected: PASS and writes `output/playwright/agent-browser-visual-smoke.png`.

- [ ] **Step 3: Copy screenshot evidence**

Copy visual screenshot to `docs/superpowers/plans/2026-05-07-shared-workspace-agents-governance-visual-smoke.png`.

- [ ] **Step 4: Run full verification**

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`
Expected: PASS.

## Self-Review

- Spec coverage: shared publication, versioning, permissions, discovery, audit visibility, and usage analytics are mapped to the service, Settings UI, prompt context, and tests.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: state, catalog, audit, and usage names are defined before being referenced.
