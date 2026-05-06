# Evaluation-Native Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live evaluation scoring to Agent Browser run evidence so operators can inspect quality scores alongside transcripts, tool trajectory, and run artifacts.

**Architecture:** Keep ProcessLog as the canonical per-turn evidence stream. Add a pure `evaluationObservability` service that converts process entries and assistant messages into scorer results, dataset case metadata, and experiment summaries, then render those results in the existing ProcessPanel instead of creating a separate dashboard store.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, existing `agent-browser` ProcessPanel, `ProcessLog`, `ChatMessage`, and `visual:agent-browser` smoke checks.

---

## Linear Source

Issue: TK-41, "Add evaluation-native observability and live scorers"

Problem statement: `agent-browser` can show activity and logs, but it still lacks a first-class way to score runs, compare quality over time, and inspect agent performance using the same operational surface that already holds runtime evidence.

Implementation intent: Add structured live scorers for browser/chat runs, dataset and experiment support for regression-style quality tracking, and dashboards that connect quality scores to run artifacts, transcripts, and tool trajectories.

## Files

- Create: `agent-browser/src/services/evaluationObservability.ts`
- Create: `agent-browser/src/services/evaluationObservability.test.ts`
- Modify: `agent-browser/src/features/process/ProcessPanel.tsx`
- Modify: `agent-browser/src/features/process/ProcessPanel.test.tsx`
- Modify: `agent-browser/src/App.css`
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Modify: `agent-browser/scripts/run-script-tests.mjs`

## Technical Spec

### Service Model

`evaluationObservability.ts` owns these contracts:

- `EvaluationScorerResult`: scorer id, label, numeric score, status, summary, evidence entry ids.
- `EvaluationDatasetCase`: stable case id, run id, input/output summaries, artifact count, trace count.
- `EvaluationExperimentSummary`: experiment id, dataset id, aggregate score, passing count, failing count.
- `EvaluationRunScore`: overall score, verdict, scorer results, dataset case, experiment summary.
- `scoreEvaluationRun(input)`: deterministic scoring from `ChatMessage` and `ProcessEntry[]`.

### Live Scorers

The first iteration ships deterministic local scorers:

- `trace-coverage`: rewards runs with captured ProcessLog events and transcript/payload detail.
- `tool-reliability`: rewards tool-call entries that settle without failed statuses.
- `artifact-evidence`: rewards cards and evidence-bearing process payloads so scores stay attached to artifacts.
- `latency-budget`: rewards completed runs that fit a configurable time budget.

The scorer output must include evidence entry ids so the UI can connect each score to rows in the ProcessPanel graph.

### Dataset and Experiment Support

The service must create one dataset case per assistant message:

- `caseId`: `eval-case:<message.id>`
- `runId`: message id
- `inputSummary`: compact prompt or "Assistant turn"
- `outputSummary`: compact assistant output/status
- `traceEntryCount`
- `artifactCount`

The experiment summary is deterministic and local:

- `experimentId`: `live:<message.id>`
- `datasetId`: `agent-browser-live-runs`
- aggregate score equals the current run score.

This keeps the implementation offline-first and testable while matching the issue's dataset/experiment concept.

### UI Behavior

`ProcessPanel` renders an Evaluation strip above the process graph when a message has process entries or legacy evidence:

- Overall score and verdict.
- Compact cards for live scorers.
- Dataset case id and experiment id.
- Scorer evidence counts so operators can connect scores to process trajectory.

The strip must be dense, mobile-friendly, keyboard-neutral, and avoid taking over the run detail pane.

## One-Shot LLM Prompt

You are implementing TK-41 in `C:\Users\conta\.codex\worktrees\be2d\agent-harness`.

Add evaluation-native observability to Agent Browser by deriving deterministic live scorer results from the existing ProcessLog/ProcessPanel evidence stream. Create `agent-browser/src/services/evaluationObservability.ts` with score contracts, dataset case generation, experiment summary generation, and four local scorers: trace coverage, tool reliability, artifact evidence, and latency budget. Write service tests first and verify they fail before implementation. Render the resulting score strip in `agent-browser/src/features/process/ProcessPanel.tsx`, with tests that prove ProcessPanel shows "Evaluation", scorer names, dataset case id, and experiment id. Add responsive CSS in `App.css`. Extend visual-smoke/script coverage so the settings/run visual path asserts the evaluation-native observability labels. Run focused tests, `npm.cmd run verify:agent-browser`, and copy the visual smoke screenshot to `docs/superpowers/plans/2026-05-06-evaluation-native-observability-visual-smoke.png` for the PR.

## TDD Tasks

### Task 1: Pure Evaluation Service

**Files:**
- Create: `agent-browser/src/services/evaluationObservability.test.ts`
- Create: `agent-browser/src/services/evaluationObservability.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { scoreEvaluationRun } from './evaluationObservability';

describe('evaluationObservability', () => {
  it('scores live run traces and links scorer evidence to process entries', () => {
    const scored = scoreEvaluationRun({
      message: {
        id: 'assistant-1',
        role: 'assistant',
        status: 'complete',
        content: 'Found the failing selector and patched the settings panel.',
        cards: [{ app: 'Browser evidence', args: { screenshot: 'output.png' } }],
      },
      entries: [
        { id: 'trace-1', position: 0, ts: 1000, endedAt: 1400, kind: 'reasoning', actor: 'planner', summary: 'Plan', transcript: 'Inspect failure', status: 'done' },
        { id: 'tool-1', position: 1, ts: 1500, endedAt: 2100, kind: 'tool-call', actor: 'playwright', summary: 'Capture screenshot', payload: { screenshot: 'output.png' }, status: 'done' },
        { id: 'done-1', position: 2, ts: 2200, endedAt: 2400, kind: 'completion', actor: 'completion-checker', summary: 'Done', status: 'done' },
      ],
    });

    expect(scored.verdict).toBe('passing');
    expect(scored.scorers.map((scorer) => scorer.id)).toEqual([
      'trace-coverage',
      'tool-reliability',
      'artifact-evidence',
      'latency-budget',
    ]);
    expect(scored.scorers.find((scorer) => scorer.id === 'artifact-evidence')?.evidenceEntryIds).toEqual(['tool-1']);
    expect(scored.datasetCase.caseId).toBe('eval-case:assistant-1');
    expect(scored.experiment.experimentId).toBe('live:assistant-1');
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/services/evaluationObservability.test.ts`

Expected: FAIL because `evaluationObservability` does not exist.

- [ ] **Step 3: Implement service**

Implement deterministic scorers, status thresholds, dataset case generation, and experiment summary generation.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/services/evaluationObservability.test.ts`

Expected: PASS.

### Task 2: ProcessPanel Score Strip

**Files:**
- Modify: `agent-browser/src/features/process/ProcessPanel.test.tsx`
- Modify: `agent-browser/src/features/process/ProcessPanel.tsx`
- Modify: `agent-browser/src/App.css`

- [ ] **Step 1: Write failing UI test**

Add a ProcessPanel test that renders a completed assistant message with process entries and a browser evidence card, then asserts "Evaluation", "Trace coverage", "Tool reliability", `eval-case:<message id>`, and `live:<message id>` are visible.

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/features/process/ProcessPanel.test.tsx`

Expected: FAIL because ProcessPanel does not render evaluation results.

- [ ] **Step 3: Implement UI**

Import `scoreEvaluationRun`, compute the result from visible entries, and render the score strip above `ProcessGraph`.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/features/process/ProcessPanel.test.tsx`

Expected: PASS.

### Task 3: Visual Smoke Script Coverage

**Files:**
- Modify: `agent-browser/scripts/run-script-tests.mjs`
- Modify: `agent-browser/scripts/visual-smoke.mjs`

- [ ] **Step 1: Write failing script assertion**

Add `run-script-tests.mjs` assertions that `visual-smoke.mjs` checks "Evaluation" and "Live experiment".

- [ ] **Step 2: Run script tests to verify RED**

Run: `npm.cmd --workspace agent-browser run test:scripts`

Expected: FAIL until `visual-smoke.mjs` contains the new assertions.

- [ ] **Step 3: Update visual smoke**

Open a seeded process/activity panel in the visual smoke flow and assert the evaluation strip labels render.

- [ ] **Step 4: Run script tests to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test:scripts`

Expected: PASS.

### Task 4: Full Verification and PR

- [ ] **Step 1: Run focused checks**

Run:

```powershell
npm.cmd --workspace agent-browser run test -- src/services/evaluationObservability.test.ts
npm.cmd --workspace agent-browser run test -- src/features/process/ProcessPanel.test.tsx
npm.cmd --workspace agent-browser run test:scripts
```

- [ ] **Step 2: Run full Agent Browser verifier**

Run: `npm.cmd run verify:agent-browser`

Expected: generated-file check, eval validation/tests, script tests, lint, coverage, build, audit, and visual smoke pass.

- [ ] **Step 3: Copy visual evidence**

Copy `output/playwright/agent-browser-visual-smoke.png` to `docs/superpowers/plans/2026-05-06-evaluation-native-observability-visual-smoke.png`.

- [ ] **Step 4: Publish**

Create branch `codex/tk-41-evaluation-native-observability`, commit, push, open PR, add `codex` and `codex-automation` labels, link the PR to TK-41, and move TK-41 to Done after successful verification.

## Self-Review

Spec coverage: The service covers live scorers, dataset cases, experiments, and evidence linkage. The UI covers the dashboard requirement by placing scores directly beside transcripts and trajectory rows in ProcessPanel.

Placeholder scan: No task relies on TBD or hand-wavy later implementation. Each task lists concrete files, commands, and expected results.

Type consistency: `EvaluationRunScore`, `EvaluationScorerResult`, `EvaluationDatasetCase`, and `EvaluationExperimentSummary` are used consistently across service tests, ProcessPanel, and visual smoke coverage.
