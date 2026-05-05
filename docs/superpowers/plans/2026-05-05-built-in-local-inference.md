# Built-In Local Inference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Agent Browser's built-in, browser-resident local inference path first-class, visible, and switchable from hosted providers.

**Architecture:** The existing Codi path already runs in-browser Transformers.js ONNX models through `browserInferenceEngine`, `LocalLanguageModel`, and `streamCodiChat`. This feature adds a small readiness/constraints service plus a Settings status surface so users can understand offline readiness, hardware fit, privacy boundaries, and provider switching without introducing another inference backend.

**Tech Stack:** React 18, TypeScript, Vitest, Transformers.js, existing Agent Browser Settings, Codi provider, `STORAGE_KEYS.installedModels`.

---

## Feature Implementation Plan

1. Preserve the existing model runtime surface:
   - `agent-browser/src/services/browserInference.ts`
   - `agent-browser/src/services/browserInferenceRuntime.ts`
   - `agent-browser/src/services/localLanguageModel.ts`
   - `agent-browser/src/chat-agents/Codi/index.ts`

2. Add a deterministic readiness service:
   - `agent-browser/src/services/localInferenceReadiness.ts`
   - `agent-browser/src/services/localInferenceReadiness.test.ts`

3. Integrate readiness into Settings:
   - `agent-browser/src/App.tsx`
   - `agent-browser/src/App.smoke.test.tsx`
   - `agent-browser/scripts/visual-smoke.mjs`
   - `agent-browser/src/App.css`

4. Validate through focused tests first, then `npm run verify:agent-browser`, and capture visual smoke output for the PR.

## Technical Spec

### Existing Architecture Alignment

- Codi is the first-class local provider in `AgentProvider`; it already appears in the chat provider selector and can be selected per session.
- Installed browser models are persisted under `STORAGE_KEYS.installedModels`, and the Settings panel already supports search/install/delete for browser-runnable ONNX models.
- Hosted providers are GHCP, Cursor, and Codex; Codi should be presented as the built-in local equivalent, not a localhost sidecar.
- The `Local OpenAI-compatible endpoint` Settings section remains separate because it depends on a connector extension and a local server; TK-49 is specifically about the browser-resident path.

### Behavioral Requirements

- When no Codi model is installed, Settings must show local inference as not ready and direct the user to install a text-generation ONNX model.
- When a text-generation Codi model is installed, Settings must show offline-ready status and name the active model.
- Hardware constraints must be summarized from model size and optional browser hardware metadata.
- The UI must state constraints plainly: first-run model download/cache, browser memory limits, ReAct-style tool calls, no native hosted-model function calling, and no localhost sidecar requirement.
- The chat header provider switch remains the workflow switch between Codi and hosted providers; no new parallel provider state should be introduced.

### Data Model

`LocalInferenceReadiness`:

```ts
export interface LocalInferenceReadiness {
  status: 'ready' | 'needs-model' | 'limited';
  title: string;
  summary: string;
  activeModelName: string | null;
  badge: string;
  badges: string[];
  constraints: string[];
}
```

### Implementation Tasks

### Task 1: Local Inference Readiness Service

**Files:**
- Create: `agent-browser/src/services/localInferenceReadiness.ts`
- Create: `agent-browser/src/services/localInferenceReadiness.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { assessLocalInferenceReadiness } from './localInferenceReadiness';
import type { HFModel } from '../types';

const installedModel: HFModel = {
  id: 'onnx-community/Qwen3-0.6B-ONNX',
  name: 'Qwen3-0.6B-ONNX',
  author: 'onnx-community',
  task: 'text-generation',
  downloads: 5000,
  likes: 30,
  tags: ['transformers.js', 'onnx'],
  sizeMB: 768,
  status: 'installed',
};

describe('assessLocalInferenceReadiness', () => {
  it('marks Codi ready when an installed text-generation model can run in the browser', () => {
    const readiness = assessLocalInferenceReadiness({
      installedModels: [installedModel],
      selectedModelId: installedModel.id,
      hardware: { deviceMemoryGB: 8, logicalCores: 8 },
    });

    expect(readiness.status).toBe('ready');
    expect(readiness.activeModelName).toBe('Qwen3-0.6B-ONNX');
    expect(readiness.badges).toContain('Offline ready');
    expect(readiness.badges).toContain('No sidecar');
    expect(readiness.constraints.join(' ')).toContain('ReAct');
  });

  it('returns install guidance when no browser chat model is installed', () => {
    const readiness = assessLocalInferenceReadiness({
      installedModels: [],
      selectedModelId: '',
      hardware: { deviceMemoryGB: null, logicalCores: null },
    });

    expect(readiness.status).toBe('needs-model');
    expect(readiness.summary).toContain('Install');
    expect(readiness.badge).toBe('Install model');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test -- src/services/localInferenceReadiness.test.ts`

Expected: FAIL because `localInferenceReadiness.ts` does not exist.

- [ ] **Step 3: Implement the service**

Create `assessLocalInferenceReadiness` with deterministic model selection, badge construction, and constraint messages.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd --workspace agent-browser run test -- src/services/localInferenceReadiness.test.ts`

Expected: PASS.

### Task 2: Settings UI Integration

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.smoke.test.tsx`
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Modify: `agent-browser/src/App.css`

- [ ] **Step 1: Write failing UI smoke coverage**

Add to `App.smoke.test.tsx`:

```ts
it('shows built-in local inference readiness in Settings', async () => {
  vi.useFakeTimers();
  window.localStorage.setItem(STORAGE_KEYS.installedModels, JSON.stringify([{
    id: 'onnx-community/Qwen3-0.6B-ONNX',
    name: 'Qwen3-0.6B-ONNX',
    author: 'onnx-community',
    task: 'text-generation',
    downloads: 5000,
    likes: 30,
    tags: ['onnx'],
    sizeMB: 768,
    status: 'installed',
  }]));

  render(<App />);

  await act(async () => {
    vi.advanceTimersByTime(350);
  });

  fireEvent.click(screen.getByLabelText('Settings'));

  expect(screen.getByText('Built-in local inference')).toBeInTheDocument();
  expect(screen.getByText('Offline ready')).toBeInTheDocument();
  expect(screen.getByText(/Qwen3-0\.6B-ONNX/)).toBeInTheDocument();
  expect(screen.getByText(/No localhost sidecar/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx`

Expected: FAIL because Settings does not yet render the local inference readiness card.

- [ ] **Step 3: Render the card**

Import `assessLocalInferenceReadiness`, compute the active selected Codi model inside `SettingsPanel`, and render a `LocalInferenceReadinessCard` before the separate `Local OpenAI-compatible endpoint` section.

- [ ] **Step 4: Add minimal CSS**

Use existing `provider-card`, `badge`, and restrained grid styling. Add only small styles for `.local-inference-metrics` and `.local-inference-constraints`.

- [ ] **Step 5: Add visual smoke assertion**

After opening Settings in `agent-browser/scripts/visual-smoke.mjs`, assert `Built-in local inference` is visible.

- [ ] **Step 6: Run app smoke**

Run: `npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx`

Expected: PASS.

### Task 3: Verification And PR

**Files:**
- Generated visual evidence: `docs/superpowers/plans/2026-05-05-built-in-local-inference-visual-smoke.png`

- [ ] **Step 1: Run focused checks**

Run:

```powershell
npm.cmd --workspace agent-browser run test -- src/services/localInferenceReadiness.test.ts
npm.cmd --workspace agent-browser run test:app -- src/App.smoke.test.tsx
npm.cmd --workspace agent-browser run lint
```

- [ ] **Step 2: Run full repo gate**

Run: `npm.cmd run verify:agent-browser`

- [ ] **Step 3: Capture visual evidence**

Run:

```powershell
$env:AGENT_BROWSER_VISUAL_SMOKE_SCREENSHOT='docs/superpowers/plans/2026-05-05-built-in-local-inference-visual-smoke.png'
npm.cmd run visual:agent-browser
Remove-Item Env:\AGENT_BROWSER_VISUAL_SMOKE_SCREENSHOT
```

- [ ] **Step 4: Commit and PR**

Run:

```powershell
& .\scripts\codex-git.ps1 checkout -b codex/tk-49-built-in-local-inference
& .\scripts\codex-git.ps1 add agent-browser/src/services/localInferenceReadiness.ts agent-browser/src/services/localInferenceReadiness.test.ts agent-browser/src/App.tsx agent-browser/src/App.smoke.test.tsx agent-browser/src/App.css agent-browser/scripts/visual-smoke.mjs docs/superpowers/plans/2026-05-05-built-in-local-inference.md docs/superpowers/plans/2026-05-05-built-in-local-inference-visual-smoke.png
& .\scripts\codex-git.ps1 commit -m "feat: surface built-in local inference readiness"
& .\scripts\codex-git.ps1 push -u origin codex/tk-49-built-in-local-inference
& .\scripts\codex-gh.ps1 pr create --base main --head codex/tk-49-built-in-local-inference --title "feat: surface built-in local inference readiness" --body-file pr-body.md
```

## One-Shot LLM Prompt

You are implementing Linear TK-49 in `agent-harness`. Agent Browser already has Codi, an in-browser local inference path powered by Transformers.js ONNX through `browserInferenceEngine`, `browserInferenceRuntime`, `LocalLanguageModel`, and `streamCodiChat`. Do not add a sidecar server or a new provider. Make built-in local inference first-class by adding a deterministic `localInferenceReadiness` service that summarizes whether installed browser models make Codi offline-ready, which selected model is active, hardware/model constraints, privacy/no-sidecar properties, and tool-call limitations. Add a Settings card titled `Built-in local inference` that uses this service, appears separately from the `Local OpenAI-compatible endpoint` connector section, and clearly shows offline readiness, active model, no-localhost-sidecar behavior, and constraints. Use TDD: first add `localInferenceReadiness.test.ts` and App smoke coverage that fail, then implement service/UI/CSS, update `visual-smoke.mjs` to assert the new Settings card, run focused tests, run `npm.cmd run verify:agent-browser`, capture a visual smoke screenshot under `docs/superpowers/plans/`, and open a PR linked to TK-49.

## Self-Review

- Spec coverage: issue requirements are mapped to Codi runtime reuse, model download/install visibility, local/offline readiness, hardware constraints, and hosted-provider switching.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: `HFModel`, Settings props, and readiness service types align with existing `agent-browser/src/types/index.ts`.
