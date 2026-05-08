# n8n Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Agent Browser surface that inventories n8n-style automation capabilities and maps the first offline implementation slice to CNCF Serverless Workflow serialization.

**Architecture:** Keep the researched capability catalog in a pure `agent-browser/src/services/n8nCapabilities.ts` service so UI, prompt context, and tests share one source of truth. Surface the catalog in Settings as an offline automation blueprint rather than a separate route or backend-dependent workflow engine.

**Tech Stack:** React, TypeScript, Vitest, Vite, Playwright visual smoke, current Agent Browser Settings patterns, CNCF Serverless Workflow JSON-compatible structures.

---

## Linear Description

TK-51 asks for research on n8n feature coverage, then an offline PWA/SPAs path to duplicate those capabilities for local development. It also asks for a CNCF-approved serverless workflow serialization format to build, store, and share workflows.

## Research Notes

- n8n workflows are node graphs that automate a process, can be created from templates, debugged through executions, shared, and exported/imported.
- n8n nodes split into triggers and actions; core nodes provide logic, scheduling, and generic HTTP behavior; community/custom nodes extend the library.
- n8n executions distinguish manual development runs from production trigger/schedule/polling runs, and execution lists plus redaction support debugging and data safety.
- n8n projects, workflow sharing, credential sharing, variables, source control/environments, templates, and RBAC form the collaboration/governance layer.
- n8n AI features include agents, tools, chains, vector stores, RAG workflows, memory, and evaluations.
- CNCF Serverless Workflow is the standards-backed serialization target. The official site lists version 1.0.3 and SDKs including TypeScript; the CNCF project page describes it as the Serverless Workflow DSL specification.

Sources used: `https://docs.n8n.io/`, `https://docs.n8n.io/workflows/`, `https://docs.n8n.io/workflows/executions/`, `https://docs.n8n.io/integrations/builtin/node-types/`, `https://docs.n8n.io/glossary/`, `https://docs.n8n.io/source-control-environments/`, `https://docs.n8n.io/advanced-ai/rag-in-n8n/`, `https://serverlessworkflow.io/`, `https://www.cncf.io/projects/serverless-workflow/`.

## Feature Implementation Plan

1. Add a deterministic n8n capability catalog and Serverless Workflow mapping service.
2. Add Settings UI that shows the offline automation blueprint, category readiness, and starter workflow serialization.
3. Add App smoke and visual-smoke coverage so the new surface remains visible at desktop/mobile widths.
4. Validate focused service/UI tests, script tests, generated-file checks, full Agent Browser verifier, and screenshot evidence.

## Architecture-Aligned Technical Spec

### Data Model

`agent-browser/src/services/n8nCapabilities.ts` owns:

```ts
export type N8nCapabilityStatus = 'planned' | 'foundation' | 'ready';

export interface N8nCapabilityArea {
  id: string;
  title: string;
  summary: string;
  n8nFeatures: string[];
  offlinePwaPlan: string[];
  serverlessWorkflowMapping: string[];
  status: N8nCapabilityStatus;
}

export interface ServerlessWorkflowPreview {
  document: {
    document: {
      dsl: '1.0.3';
      namespace: string;
      name: string;
      version: string;
    };
    do: Array<Record<string, unknown>>;
  };
  coverage: string[];
}
```

### UI Contract

Settings gets an `n8n capabilities` section with:

- a summary card naming CNCF Serverless Workflow 1.0.3;
- six capability cards for workflow canvas, node library, executions, credentials/governance, templates/environments, and AI/RAG/evaluations;
- a starter workflow preview that is JSON-like, copyable by inspection, and mapped to trigger/action/error-review steps.

### Test Contract

Unit tests must prove:

- the catalog covers the key researched n8n capability areas;
- every capability maps to at least one offline PWA plan item and one Serverless Workflow primitive;
- the starter workflow preview uses DSL `1.0.3`, contains trigger/action/error-review steps, and reports matching coverage;
- persisted/UI validation does not require external network state.

## One-Shot LLM Prompt

```text
You are implementing Linear TK-51 in agent-browser. Add a research-backed offline automation capabilities blueprint for duplicating n8n-style features locally.

Follow existing Agent Browser patterns:
- Add `agent-browser/src/services/n8nCapabilities.ts` with a pure TypeScript catalog covering workflow canvas, node library, executions, credentials/governance, templates/environments, and AI/RAG/evaluations.
- Include a CNCF Serverless Workflow 1.0.3 starter workflow preview and deterministic helpers for capability summaries.
- Add `agent-browser/src/services/n8nCapabilities.test.ts` before production code and verify RED before implementation.
- Wire a compact `n8n capabilities` section into `agent-browser/src/App.tsx` Settings.
- Add App smoke and `agent-browser/scripts/visual-smoke.mjs` assertions for the visible Settings surface.
- Save screenshot evidence under `docs/superpowers/plans/2026-05-08-n8n-capabilities-visual-smoke.png`.

Use TDD. Keep this first slice narrow: an inspectable local blueprint and serialization foundation, not a full workflow engine.
```

## TDD Task Plan

### Task 1: Capability Catalog Service

**Files:**
- Create: `agent-browser/src/services/n8nCapabilities.ts`
- Create: `agent-browser/src/services/n8nCapabilities.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
expect(listN8nCapabilityAreas().map((area) => area.id)).toEqual([
  'workflow-canvas',
  'node-library',
  'executions-debugging',
  'credentials-governance',
  'templates-environments',
  'ai-rag-evaluations',
]);
expect(buildServerlessWorkflowPreview().document.document.dsl).toBe('1.0.3');
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/services/n8nCapabilities.test.ts`
Expected: FAIL because `n8nCapabilities.ts` does not exist.

- [ ] **Step 3: Implement the minimal service**

Create static capability areas, an immutable list helper, status summary helper, and starter workflow preview.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/services/n8nCapabilities.test.ts`
Expected: PASS.

### Task 2: Settings Surface

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.smoke.test.tsx`
- Modify: `agent-browser/src/App.css`

- [ ] **Step 1: Write failing UI test**

```ts
fireEvent.click(screen.getByLabelText('Settings'));
expect(screen.getByRole('button', { name: 'n8n capabilities' })).toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: 'n8n capabilities' }));
expect(screen.getByText('CNCF Serverless Workflow 1.0.3')).toBeInTheDocument();
expect(screen.getByText('Workflow canvas')).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx -t "renders n8n capabilities"`
Expected: FAIL because the Settings section is missing.

- [ ] **Step 3: Implement the Settings panel**

Import the service, render summary metrics, capability cards, status badges, and starter workflow step chips.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx -t "renders n8n capabilities"`
Expected: PASS.

### Task 3: Visual Smoke and Verification

**Files:**
- Modify: `agent-browser/scripts/visual-smoke.mjs`

- [ ] **Step 1: Add visual smoke assertions**

Assert Settings exposes `n8n capabilities`, `CNCF Serverless Workflow 1.0.3`, and the capability cards.

- [ ] **Step 2: Run validation**

Run:

```powershell
npm.cmd --workspace agent-browser run test -- src/services/n8nCapabilities.test.ts
npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx -t "renders n8n capabilities"
npm.cmd --workspace agent-browser run test:scripts
npm.cmd run check:generated-files
npm.cmd run visual:agent-browser
npm.cmd run verify:agent-browser
```

Expected: All pass; visual smoke writes the screenshot used in the PR body.
