# Extension Plugin Dependency Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add installable Agent Browser extension bundles with transitive dependency resolution so extension definitions can depend on other extensions they hook into.

**Architecture:** Extend the existing default extension marketplace service instead of adding a new package manager. Dependency declarations live in plugin or marketplace `metadata.dependencies` arrays, install/enable/uninstall flows resolve those dependencies deterministically, and the Extensions UI displays dependency status from the same pure service helpers.

**Tech Stack:** React 18, TypeScript, Vitest, Agent Browser default extension manifests, harness-core plugin manifest metadata, Playwright visual smoke.

---

## Feature Implementation Plan

TK-56 asks for installable extension bundles like VS Code, Pi agent, Claude Code, and GitHub Copilot, plus derivative extensions that can require transient dependencies. The first end-to-end slice is: built-in extension metadata can declare dependencies, installing a dependent extension installs its dependency closure, enabling/disabling honors dependency order, uninstalling a base extension removes dependents, and the UI makes dependency relationships visible.

## Technical Spec

### Data Contract

Dependencies are declared as string extension IDs under `metadata.dependencies` on either the marketplace entry or the plugin manifest:

```json
{
  "metadata": {
    "dependencies": ["agent-harness.ext.design-md-context"]
  }
}
```

Marketplace metadata wins only by being merged with manifest metadata; duplicate IDs are removed. Invalid IDs are ignored by resolution but reported as missing dependency entries for UI and tests.

### Service Behavior

`agent-browser/src/services/defaultExtensions.ts` owns the dependency graph because it already normalizes default extension IDs and controls installed runtime creation.

- `getDefaultExtensionDependencyIds(extension)` returns normalized direct dependency IDs.
- `resolveDefaultExtensionDependencyPlan(extensionIds)` returns requested IDs plus transitive dependencies in dependency-first order and reports missing/cyclic dependencies.
- `resolveDefaultExtensionDependents(extensionIds)` returns installed/default extensions that depend on the provided IDs.
- `selectInstalledDefaultExtensionIds()` applies the dependency plan before runtime loading.

### UI Behavior

`MarketplacePanel` and `ExtensionsPanel` display dependency chips:

- Marketplace cards show `Requires <name>` for direct dependencies.
- Installed cards show `Required by <name>` for dependent extensions.
- Installing an extension installs its dependency closure and enables the same closure through OpenFeature flags.
- Uninstalling an extension removes it and installed dependents from installed IDs, flags, and configuration.

### Prompt Context

Runtime extension prompt context keeps current behavior but receives the dependency-expanded runtime, so dependent runtime hooks are only active when their dependency chain is installed and enabled.

## One-Shot LLM Prompt

```text
You are implementing Linear TK-56 in Agent Browser. Add transitive default extension dependency support with TDD.

Work in agent-browser/src/services/defaultExtensions.ts first. Add helpers that read string dependency IDs from extension.marketplace.metadata.dependencies and extension.manifest.metadata.dependencies, normalize aliases through the existing normalizeDefaultExtensionIds helper, resolve transitive dependency plans in dependency-first order, and report missing/cyclic dependency IDs without throwing in normal UI flows. Update createDefaultExtensionRuntime so selected installed IDs load after dependency expansion.

Then update agent-browser/src/App.tsx extension install, enable, uninstall, marketplace card, and installed card flows. Installing or enabling a dependent extension must include its dependency closure. Uninstalling a base extension must remove installed dependents. Marketplace cards must render direct dependency names; installed cards must render dependent names. Keep controls accessible and use existing card/chip styling.

Add Vitest coverage in agent-browser/src/services/defaultExtensions.test.ts and App smoke coverage in agent-browser/src/App.smoke.test.tsx. Update agent-browser/scripts/visual-smoke.mjs to assert the dependency copy in the marketplace. Add focused CSS only if existing chips/cards need spacing. Run the focused tests first, then npm.cmd run verify:agent-browser, then copy the visual smoke screenshot to docs/superpowers/plans/2026-05-07-extension-plugin-dependency-chain-visual-smoke.png. Open a PR with the screenshot and verification evidence.
```

## File Structure

- Modify: `ext/agent-harness.marketplace.json` to declare bundled extension dependency metadata.
- Modify: `agent-browser/src/services/defaultExtensions.ts` for dependency graph helpers and dependency-expanded runtime loading.
- Modify: `agent-browser/src/services/defaultExtensions.test.ts` for service-level red/green coverage.
- Modify: `agent-browser/src/App.tsx` for install/enable/uninstall dependency-aware UI behavior and dependency labels.
- Modify: `agent-browser/src/App.smoke.test.tsx` for Settings/Extensions smoke coverage.
- Modify: `agent-browser/src/App.css` only if dependency chips need layout support.
- Modify: `agent-browser/scripts/visual-smoke.mjs` to assert dependency labels in the visual smoke path.

## TDD Task Plan

### Task 1: Dependency Graph Service

**Files:**
- Modify: `agent-browser/src/services/defaultExtensions.test.ts`
- Modify: `agent-browser/src/services/defaultExtensions.ts`

- [ ] **Step 1: Write the failing dependency closure tests**

```ts
expect(resolveDefaultExtensionDependencyPlan(['agent-harness.ext.design-studio']).extensionIds).toEqual([
  'agent-harness.ext.design-md-context',
  'agent-harness.ext.design-studio',
]);
```

- [ ] **Step 2: Run the focused service test and verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/services/defaultExtensions.test.ts`

Expected: FAIL because `resolveDefaultExtensionDependencyPlan` is not exported.

- [ ] **Step 3: Implement minimal dependency helpers**

Add dependency readers, DFS dependency ordering, missing/cycle diagnostics, and runtime install expansion inside `defaultExtensions.ts`.

- [ ] **Step 4: Run the focused service test and verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/services/defaultExtensions.test.ts`

Expected: PASS.

### Task 2: App Install/Uninstall UI

**Files:**
- Modify: `agent-browser/src/App.smoke.test.tsx`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.css`

- [ ] **Step 1: Write the failing App smoke test**

```ts
fireEvent.click(screen.getByLabelText('Extensions'));
expect(screen.getByText('Requires DESIGN.md agent guidance')).toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: 'Install Design Studio' }));
expect(screen.getByRole('region', { name: 'Installed extensions' })).toHaveTextContent('DESIGN.md agent guidance');
```

- [ ] **Step 2: Run the focused smoke test and verify RED**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx`

Expected: FAIL because dependency labels and closure install are missing.

- [ ] **Step 3: Implement minimal UI behavior**

Thread dependency helper outputs into marketplace and installed cards. Update install, enable, and uninstall callbacks to operate on dependency closure/dependents.

- [ ] **Step 4: Run the focused smoke test and verify GREEN**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx`

Expected: PASS.

### Task 3: Visual Smoke and Repo Verification

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Create: `docs/superpowers/plans/2026-05-07-extension-plugin-dependency-chain-visual-smoke.png`

- [ ] **Step 1: Add visual-smoke assertions**

Assert that the extension marketplace shows dependency metadata for `Design Studio` and that the UI remains visible.

- [ ] **Step 2: Run verification**

Run: `npm.cmd run verify:agent-browser`

Expected: PASS, including visual smoke.

- [ ] **Step 3: Preserve screenshot evidence**

Copy `output/playwright/agent-browser-visual-smoke.png` to `docs/superpowers/plans/2026-05-07-extension-plugin-dependency-chain-visual-smoke.png`.

## Self-Review

Spec coverage: dependency declaration, transitive installation, dependency-aware enablement, dependent removal, UI visibility, tests, and visual proof are all covered.

Placeholder scan: no TBD/TODO placeholders remain.

Type consistency: helper names use the `DefaultExtension` prefix and operate on normalized extension IDs already used by the service.
