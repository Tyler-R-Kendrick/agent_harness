# Browser Workflow Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class repeatable browser workflow skill packages with metadata, instructions, permissions, assets, scripts, discovery/install/use flows, and task-time suggestions.

**Architecture:** Keep the product surface inside Agent Browser, not workspace AGENTS.md. Add a deterministic `browserWorkflowSkills` service that parses workspace-file manifests from `.agents/browser-workflows/<id>/skill.json`, creates built-in installable manifests, derives suggestions from task text, and renders prompt context for selected skills. Wire it into existing workspace file persistence, Settings, chat autocomplete, and visual smoke coverage.

**Tech Stack:** TypeScript, React, Vitest, existing `WorkspaceFile` storage, Agent Browser Settings/Chat surfaces, Playwright visual smoke.

---

## Feature Plan

1. Define a browser workflow skill manifest format:
   - `schemaVersion: 1`
   - `id`, `name`, `version`, `description`
   - `instructions` as markdown text
   - `permissions` with `tools`, `paths`, and `network` arrays
   - `assets` with `path`, `description`, and `required`
   - `scripts` with `name`, `command`, and `description`
   - `triggers` for task-time suggestions
2. Discover installed manifests from workspace files under `.agents/browser-workflows/<id>/skill.json`.
3. Provide built-in installable browser workflows for visual review and bug reproduction.
4. Add an install flow that writes a manifest file into the active workspace files.
5. Add task-time suggestions in the chat composer based on typed intent and `@` autocomplete.
6. Add prompt context so selected/suggested browser workflow skills can be used by the agent.
7. Add Settings UI and visual smoke assertions for discovery/install/suggestions.

## Technical Spec

### Data Model

```ts
export interface BrowserWorkflowSkillManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  description: string;
  instructions: string;
  permissions: {
    tools: string[];
    paths: string[];
    network: string[];
  };
  assets: Array<{
    path: string;
    description: string;
    required: boolean;
  }>;
  scripts: Array<{
    name: string;
    command: string;
    description: string;
  }>;
  triggers: string[];
}
```

### File Contract

Installed browser workflow skills are workspace files at:

```text
.agents/browser-workflows/<skill-id>/skill.json
```

This avoids product-agent confusion with `.agents/<name>/AGENTS.md` and preserves the existing rule that workspace AGENTS files are user/project instructions.

### Service Responsibilities

`agent-browser/src/services/browserWorkflowSkills.ts` owns:

- `DEFAULT_BROWSER_WORKFLOW_SKILLS`
- `createBrowserWorkflowSkillFile(manifest, updatedAt)`
- `discoverBrowserWorkflowSkills(files)`
- `installBrowserWorkflowSkill(files, manifest, updatedAt)`
- `suggestBrowserWorkflowSkills(input, skills, limit)`
- `buildBrowserWorkflowSkillPromptContext(suggestions)`
- `isBrowserWorkflowSkillManifest(value)`

### UI Responsibilities

`agent-browser/src/App.tsx` owns:

- Active workspace skill discovery from `activeWorkspaceFiles`
- Settings section named `Browser workflow skills`
- Install buttons for built-in uninstalled skills
- Installed package cards showing permissions, assets, scripts, and triggers
- Chat composer suggestion strip when current text matches skill triggers
- `@skill` autocomplete including browser workflow skills

### Testing Strategy

1. Service tests prove schema validation, discovery, immutable install, suggestions, and prompt context.
2. App smoke test proves Settings install/discovery and chat suggestion rendering.
3. Script test/visual smoke assertions prove the UI is stable in real browser validation.
4. Full repo gate remains `npm.cmd run verify:agent-browser`.

## One-Shot LLM Prompt

```text
Implement Linear TK-21 in Agent Browser.

Create a first-class browser workflow skill package format discovered from workspace files at `.agents/browser-workflows/<id>/skill.json`. Each manifest must include schemaVersion 1, metadata, markdown instructions, permission scopes for tools/paths/network, assets, scripts, and triggers. Add a deterministic TypeScript service with validation, discovery, immutable install, task-time suggestion, and prompt-context helpers. Add tests first and prove they fail before implementation.

Wire the service into Agent Browser: use active workspace files to discover installed workflow skills, add Settings UI called "Browser workflow skills" with install buttons for built-in visual-review and bug-repro workflows, show installed cards with permissions/assets/scripts/triggers, include workflow skills in @ autocomplete, and show task-time suggestions in the chat composer when typed text matches triggers.

Add focused Vitest coverage, App smoke coverage, visual-smoke assertions, and a checked-in plan artifact. Follow existing App.tsx, App.css, session/workspace file, and visual-smoke patterns. Do not add product chat agents as workspace `.agents/<name>/AGENTS.md` files. Run `npm.cmd run verify:agent-browser` before publishing. If verification or publishing is blocked by the Windows sandbox, record exact blockers in Linear and automation memory.
```

## File Structure

- Create: `agent-browser/src/services/browserWorkflowSkills.ts`
  - Manifest validation, default manifests, discovery, install, suggestions, prompt context.
- Create: `agent-browser/src/services/browserWorkflowSkills.test.ts`
  - TDD coverage for every service function and edge case.
- Modify: `agent-browser/src/App.tsx`
  - Import service, derive installed/available skills, render Settings section, add composer suggestions and autocomplete entries.
- Modify: `agent-browser/src/App.css`
  - Compact, responsive styling for workflow skill cards and suggestion rows.
- Modify: `agent-browser/src/App.smoke.test.tsx`
  - Settings install flow and composer task-time suggestion coverage.
- Modify: `agent-browser/scripts/visual-smoke.mjs`
  - Browser-visible assertions for the Settings section and installed/default workflow skills.

## TDD Task Plan

### Task 1: Service Contract

**Files:**
- Create: `agent-browser/src/services/browserWorkflowSkills.test.ts`
- Create: `agent-browser/src/services/browserWorkflowSkills.ts`

- [ ] **Step 1: Write the failing service tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BROWSER_WORKFLOW_SKILLS,
  buildBrowserWorkflowSkillPromptContext,
  createBrowserWorkflowSkillFile,
  discoverBrowserWorkflowSkills,
  installBrowserWorkflowSkill,
  isBrowserWorkflowSkillManifest,
  suggestBrowserWorkflowSkills,
} from './browserWorkflowSkills';

describe('browserWorkflowSkills', () => {
  it('validates manifests and rejects malformed permission/script shapes', () => {
    expect(isBrowserWorkflowSkillManifest(DEFAULT_BROWSER_WORKFLOW_SKILLS[0])).toBe(true);
    expect(isBrowserWorkflowSkillManifest({ ...DEFAULT_BROWSER_WORKFLOW_SKILLS[0], schemaVersion: 2 })).toBe(false);
    expect(isBrowserWorkflowSkillManifest({ ...DEFAULT_BROWSER_WORKFLOW_SKILLS[0], permissions: { tools: ['browser'], paths: [] } })).toBe(false);
    expect(isBrowserWorkflowSkillManifest({ ...DEFAULT_BROWSER_WORKFLOW_SKILLS[0], scripts: [{ name: 'run' }] })).toBe(false);
  });

  it('discovers valid workspace manifests and ignores invalid files', () => {
    const file = createBrowserWorkflowSkillFile(DEFAULT_BROWSER_WORKFLOW_SKILLS[0], '2026-05-07T00:00:00.000Z');
    const skills = discoverBrowserWorkflowSkills([
      file,
      { path: '.agents/browser-workflows/bad/skill.json', content: '{ "schemaVersion": 1 }', updatedAt: file.updatedAt },
      { path: '.agents/skills/not-a-browser-skill/SKILL.md', content: '# ignored', updatedAt: file.updatedAt },
    ]);
    expect(skills.map((skill) => skill.id)).toEqual([DEFAULT_BROWSER_WORKFLOW_SKILLS[0].id]);
  });

  it('installs workflow skill manifests immutably without duplicating existing files', () => {
    const installed = installBrowserWorkflowSkill([], DEFAULT_BROWSER_WORKFLOW_SKILLS[0], '2026-05-07T00:00:00.000Z');
    const reinstalled = installBrowserWorkflowSkill(installed, DEFAULT_BROWSER_WORKFLOW_SKILLS[0], '2026-05-07T01:00:00.000Z');
    expect(installed).toHaveLength(1);
    expect(reinstalled).toHaveLength(1);
    expect(reinstalled[0].content).toContain('"schemaVersion": 1');
  });

  it('suggests skills from task text and renders prompt context', () => {
    const suggestions = suggestBrowserWorkflowSkills(
      'please review this UI visually and capture screenshots',
      DEFAULT_BROWSER_WORKFLOW_SKILLS,
      2,
    );
    expect(suggestions[0]).toMatchObject({ id: 'visual-review' });
    expect(buildBrowserWorkflowSkillPromptContext(suggestions)).toContain('## Browser Workflow Skills');
    expect(buildBrowserWorkflowSkillPromptContext([])).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/services/browserWorkflowSkills.test.ts`

Expected: FAIL because `./browserWorkflowSkills` does not exist.

- [ ] **Step 3: Implement the service**

Create `browserWorkflowSkills.ts` with the exported functions above, using pure functions and no browser globals.

- [ ] **Step 4: Run service tests to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/services/browserWorkflowSkills.test.ts`

Expected: PASS.

### Task 2: Workspace Discovery and Prompt Context

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.smoke.test.tsx`

- [ ] **Step 1: Write App smoke test for Settings install and suggestions**

Add a smoke test that opens Settings, expands `Browser workflow skills`, installs `Visual review workflow`, returns to chat, types `review this UI`, and expects `Suggested workflow skills` plus `Visual review workflow`.

- [ ] **Step 2: Run App smoke test to verify RED**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx`

Expected: FAIL because Settings has no `Browser workflow skills` section.

- [ ] **Step 3: Wire App state and Settings UI**

Use `discoverBrowserWorkflowSkills(activeWorkspaceFiles)` and `installBrowserWorkflowSkill(activeWorkspaceFiles, manifest)` with existing `setWorkspaceFilesByWorkspace` patterns. Add a `BrowserWorkflowSkillSettingsPanel` below `WorkspaceSkillPolicySettingsPanel`.

- [ ] **Step 4: Wire chat suggestions**

Merge browser workflow skills into `@` autocomplete, derive `suggestBrowserWorkflowSkills(input, browserWorkflowSkills, 3)`, and render a compact suggestion list above the composer when suggestions exist.

- [ ] **Step 5: Run App smoke test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx`

Expected: PASS.

### Task 3: Visual Review Coverage

**Files:**
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/scripts/visual-smoke.mjs`

- [ ] **Step 1: Add responsive styles**

Add grid-based `.browser-workflow-skill-*` classes with wrapping code chips and no nested cards.

- [ ] **Step 2: Add visual-smoke assertions**

Open Settings, expand `Browser workflow skills`, assert installable and installed skill surfaces, and capture the standard screenshot through the existing visual smoke script.

- [ ] **Step 3: Run visual smoke**

Run: `npm.cmd run visual:agent-browser`

Expected: PASS and refresh `output/playwright/agent-browser-visual-smoke.png`.

### Task 4: Full Verification and Publication

**Files:**
- All touched files

- [ ] **Step 1: Run focused gates**

Run:

```powershell
npm.cmd --workspace agent-browser run test -- src/services/browserWorkflowSkills.test.ts
npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx
npm.cmd --workspace agent-browser run test:scripts
scripts\codex-git.ps1 diff --check
```

Expected: all pass.

- [ ] **Step 2: Run full Agent Browser verifier**

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`

Expected: generated-file check, eval validation/tests, script tests, lint, coverage, build, audit, and visual smoke pass.

- [ ] **Step 3: Publish**

Run:

```powershell
scripts\codex-git.ps1 switch -c codex/tk-21-browser-workflow-skills
scripts\codex-git.ps1 add agent-browser/src/services/browserWorkflowSkills.ts agent-browser/src/services/browserWorkflowSkills.test.ts agent-browser/src/App.tsx agent-browser/src/App.css agent-browser/src/App.smoke.test.tsx agent-browser/scripts/visual-smoke.mjs docs/superpowers/plans/2026-05-07-browser-workflow-skills.md
scripts\codex-git.ps1 commit -m "feat: package browser workflow skills"
scripts\codex-git.ps1 push -u origin codex/tk-21-browser-workflow-skills
scripts\codex-gh.ps1 pr create --title "Package browser workflow skills" --body-file <generated-pr-body>
scripts\codex-gh.ps1 pr edit --add-label codex --add-label codex-automation
```

Expected: PR opens with verification details and screenshots; Linear TK-21 is linked and moved to Done after merge-ready completion.

## Self-Review

- Spec coverage: data format, discovery, install/use flow, task-time suggestions, UI, tests, and visual validation all map to tasks above.
- Placeholder scan: no TBD/TODO/fill-in steps remain; each task has concrete files and commands.
- Type consistency: service exports and App usage use `BrowserWorkflowSkillManifest`, `BrowserWorkflowSkillSuggestion`, and `WorkspaceFile` consistently.
