# Adversary Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class Agent Browser Adversary agent that produces adversarial candidate outputs, carries judge feedback through the process record, and exposes bounded operator controls.

**Architecture:** Implement the agent under `agent-browser/src/chat-agents/Adversary/` and wire it through the existing chat-agent provider router, model-backed runtime selection, prompt builders, and chat header selector. Keep deterministic candidate planning, settings validation, and judge-feedback normalization in `agent-browser/src/services/adversaryAgent.ts` so the AgentBus/process surfaces can test the behavior without a live model.

**Tech Stack:** React, TypeScript, Vitest, Agent Browser chat-agent routing, durable `sessionState` storage, existing Settings accordion UI, existing `visual:agent-browser` Playwright smoke script.

---

## Feature Implementation Plan

TK-20 asks for an Adversary agent that runs alongside happy-path outputs, tries to produce outputs that can fool judges/voters, and writes vote feedback to the event/process trail so later iterations can learn. The first implementation will make that capability explicit and bounded:

- Add an Adversary chat provider in the same first-class surface as Researcher, Debugger, Planner, Security Review, and Tour Guide.
- Add deterministic adversary settings: enabled, maximum candidates, rerun-on-adversary-win, preserve judge feedback, and stealth voter labels.
- Add a pure candidate-planning helper that always emits at least one candidate and clamps to the configured maximum.
- Add a judge-feedback record helper that distinguishes adversary wins from happy-path wins and produces process/AgentBus-ready feedback summaries.
- Add Settings controls so operators can configure the candidate cap and feedback behavior.
- Add visible smoke coverage for the provider selector and Settings controls.

## Architecture-Aligned Technical Spec

### Files

- Create `agent-browser/src/services/adversaryAgent.ts`
  - Owns `AdversaryAgentSettings`, defaults, validator, normalization, candidate planning, and judge-feedback summaries.
- Create `agent-browser/src/services/adversaryAgent.test.ts`
  - Proves candidate bounds, defaults, malformed storage rejection, eval/trajectory context inclusion, and adversary-win feedback summaries.
- Create `agent-browser/src/chat-agents/Adversary/index.ts`
  - Owns `ADVERSARY_LABEL`, trigger detection, operating instructions, system prompt, tool instructions, and model-backed streaming through GHCP/Cursor/Codex/Codi.
- Create `agent-browser/src/chat-agents/Adversary/index.test.ts`
  - Proves prompt content includes eval criteria, AgentBus trajectory, circular failures, stealth voter constraints, and candidate bounds.
- Modify `agent-browser/src/chat-agents/types.ts`
  - Add `'adversary'` to `AgentProvider`.
- Modify `agent-browser/src/chat-agents/index.ts`
  - Export Adversary helpers, route adversarial requests, resolve display name/placeholder/summary/runtime, and stream Adversary turns.
- Modify `agent-browser/src/chat-agents/index.test.ts`
  - Add Adversary display, placeholder, summary, task routing, and runtime fallback coverage.
- Modify `agent-browser/src/services/sessionState.ts`
  - Add `STORAGE_KEYS.adversaryAgentSettings`.
- Modify `agent-browser/src/App.tsx`
  - Persist settings, include Adversary in the provider selector, treat it as model-backed, show Settings controls, and include adversary state in the context strip.
- Modify `agent-browser/src/App.smoke.test.tsx`
  - Assert Adversary provider and Settings controls render.
- Modify `agent-browser/scripts/visual-smoke.mjs`
  - Assert the Adversary Settings section is visible and screenshot-covered.
- Modify `docs/superpowers/plans/2026-05-07-adversary-agent.md`
  - Keep this plan/spec/prompt artifact updated with final verification evidence.

### Data Contract

```ts
export interface AdversaryAgentSettings {
  enabled: boolean;
  maxCandidates: number;
  rerunOnAdversaryWin: boolean;
  preserveJudgeFeedback: boolean;
  stealthVoterLabels: boolean;
}
```

`maxCandidates` is clamped to `1..5`. Candidate planning returns at least one candidate whenever the feature is enabled. Judge feedback records include the winner kind, voter id, selected candidate id, reason, summary, and a durable feedback line suitable for AgentBus/process display.

### UI Contract

The Settings section title is `Adversary agent`. Controls:

- `Enable adversary candidate generation`
- `Maximum adversary candidates`
- `Rerun when adversary output wins`
- `Preserve judge feedback in AgentBus`
- `Hide adversary labels from voters`

The provider selector option label is `Adversary`. The input placeholder is `Ask Adversary...` using the repo's existing ellipsis style.

### Verification Contract

Run in order:

1. `npm.cmd --workspace agent-browser run test:coverage -- --runInBand` or focused Vitest tests when the full runner is too slow.
2. `npm.cmd --workspace agent-browser run test:scripts`.
3. `npm.cmd run check:generated-files`.
4. `npm.cmd run visual:agent-browser`.
5. `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`.
6. `scripts/codex-git.ps1 diff --check`.

If the Windows sandbox blocks Vite/esbuild or Playwright with `spawn EPERM`, preserve the exact blocker, run deterministic direct checks for touched TypeScript files, and do not claim full visual review completed.

## One-Shot LLM Implementation Prompt

You are implementing Linear TK-20 in `C:\Users\conta\.codex\worktrees\9c6b\agent-harness`.

Add a first-class Agent Browser Adversary agent. Follow the existing patterns in `agent-browser/src/chat-agents/Security/index.ts`, `Debugger/index.ts`, `Planner/index.ts`, `agent-browser/src/chat-agents/index.ts`, and `agent-browser/src/App.tsx`.

Requirements:

- Create `agent-browser/src/services/adversaryAgent.ts` with:
  - `AdversaryAgentSettings`
  - `DEFAULT_ADVERSARY_AGENT_SETTINGS`
  - `isAdversaryAgentSettings`
  - `normalizeAdversaryAgentSettings`
  - `planAdversaryCandidates`
  - `recordAdversaryJudgeFeedback`
- `planAdversaryCandidates` must include eval criteria, recent AgentBus/process trajectory, circular failure risks, a minimum of one candidate, and no more than the normalized max.
- `recordAdversaryJudgeFeedback` must identify adversary wins, happy-path wins, rerun recommendations, and feedback text for future iterations.
- Create `agent-browser/src/chat-agents/Adversary/index.ts` with prompt builders and a `streamAdversaryChat` function that delegates to Codi/GHCP/Cursor/Codex streams like Security Review does.
- Add `'adversary'` to `AgentProvider` and wire it through exports, display names, placeholders, summaries, task routing, runtime resolution, `streamAgentChat`, App provider selector, can-submit logic, and missing-model text.
- Persist Adversary settings using `STORAGE_KEYS.adversaryAgentSettings` and render Settings controls under `Adversary agent`.
- Add Vitest coverage for service behavior, prompt/routing behavior, and App smoke rendering.
- Add visual smoke assertions for the Settings controls.
- Update this plan file with verification evidence and screenshot paths after implementation.

Use TDD: write failing tests first, verify they fail for missing Adversary support, then implement the minimal code to pass.

## TDD Task Plan

### Task 1: Pure Adversary Service

**Files:**
- Create: `agent-browser/src/services/adversaryAgent.test.ts`
- Create: `agent-browser/src/services/adversaryAgent.ts`

- [ ] **Step 1: Write failing service tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADVERSARY_AGENT_SETTINGS,
  isAdversaryAgentSettings,
  normalizeAdversaryAgentSettings,
  planAdversaryCandidates,
  recordAdversaryJudgeFeedback,
} from './adversaryAgent';

describe('adversaryAgent', () => {
  it('clamps settings and rejects malformed storage payloads', () => {
    expect(isAdversaryAgentSettings(DEFAULT_ADVERSARY_AGENT_SETTINGS)).toBe(true);
    expect(isAdversaryAgentSettings({ enabled: true, maxCandidates: '3' })).toBe(false);
    expect(normalizeAdversaryAgentSettings({ ...DEFAULT_ADVERSARY_AGENT_SETTINGS, maxCandidates: 9 }).maxCandidates).toBe(5);
  });

  it('plans at least one bounded candidate from eval criteria and AgentBus trajectory', () => {
    const plan = planAdversaryCandidates({
      task: 'Implement checkout validation',
      evalCriteria: ['Reject invalid totals', 'Keep audit trail'],
      trajectory: ['Intent checkout', 'Vote policy rejected weak validation'],
      circularFailures: ['retrying the same invalid assertion'],
      settings: { ...DEFAULT_ADVERSARY_AGENT_SETTINGS, maxCandidates: 2 },
    });
    expect(plan.candidates).toHaveLength(2);
    expect(plan.contextDigest).toContain('Reject invalid totals');
    expect(plan.contextDigest).toContain('Vote policy rejected weak validation');
  });

  it('records adversary wins as rerun feedback for future iterations', () => {
    const feedback = recordAdversaryJudgeFeedback({
      voterId: 'quality-gate',
      selectedCandidateId: 'adv-1',
      selectedCandidateKind: 'adversary',
      reason: 'Judge preferred an unsafe shortcut',
      settings: DEFAULT_ADVERSARY_AGENT_SETTINGS,
    });
    expect(feedback.adversaryWon).toBe(true);
    expect(feedback.shouldRerun).toBe(true);
    expect(feedback.feedbackForNextIteration).toContain('Judge preferred an unsafe shortcut');
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test:coverage -- src/services/adversaryAgent.test.ts`

Expected: FAIL because `./adversaryAgent` does not exist.

- [ ] **Step 3: Implement the service**

Create the service with strict validators, `maxCandidates` clamping, deterministic candidate IDs, context digest rendering, and feedback summaries.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test:coverage -- src/services/adversaryAgent.test.ts`

Expected: PASS.

### Task 2: First-Class Chat Agent Routing

**Files:**
- Create: `agent-browser/src/chat-agents/Adversary/index.test.ts`
- Create: `agent-browser/src/chat-agents/Adversary/index.ts`
- Modify: `agent-browser/src/chat-agents/types.ts`
- Modify: `agent-browser/src/chat-agents/index.ts`
- Modify: `agent-browser/src/chat-agents/index.test.ts`

- [ ] **Step 1: Write failing prompt/routing tests**

Add tests that expect Adversary display names, placeholders, provider summaries, task routing for text containing `adversary`, runtime fallback to GHCP/Cursor/Codi, and prompt content naming eval criteria, AgentBus trajectory, circular failures, stealth voters, and max candidates.

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test:coverage -- src/chat-agents/Adversary/index.test.ts src/chat-agents/index.test.ts`

Expected: FAIL because the provider and prompt builder are missing.

- [ ] **Step 3: Implement routing and prompt builders**

Add `ADVERSARY_LABEL`, `isAdversaryTaskText`, `buildAdversaryOperatingInstructions`, `buildAdversarySystemPrompt`, `buildAdversaryToolInstructions`, and `streamAdversaryChat`. Mirror Security Review's multi-runtime delegation.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test:coverage -- src/chat-agents/Adversary/index.test.ts src/chat-agents/index.test.ts`

Expected: PASS.

### Task 3: App Settings and Visual Surface

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.smoke.test.tsx`
- Modify: `agent-browser/scripts/visual-smoke.mjs`

- [ ] **Step 1: Write failing UI smoke tests**

Add an App smoke test that opens Settings, expands `Adversary agent`, and asserts the five controls. Also assert the provider selector contains `Adversary`.

- [ ] **Step 2: Run test to verify RED**

Run: `npm.cmd --workspace agent-browser run test:coverage -- src/App.smoke.test.tsx`

Expected: FAIL because the provider option and Settings section do not exist.

- [ ] **Step 3: Implement UI and storage**

Add the storage key, `useStoredState`, Settings panel, provider selector option, can-submit support, missing-model copy, and context-strip status.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm.cmd --workspace agent-browser run test:coverage -- src/App.smoke.test.tsx`

Expected: PASS.

### Task 4: Full Verification and PR

**Files:**
- Modify: `docs/superpowers/plans/2026-05-07-adversary-agent.md`
- Add: `docs/superpowers/plans/2026-05-07-adversary-agent-visual-smoke.png` if visual smoke succeeds.

- [ ] **Step 1: Run full local verification**

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`

Expected: PASS, including lint, coverage, build, audit, and visual smoke.

- [ ] **Step 2: Copy visual evidence if needed**

Run: copy the generated visual smoke screenshot into `docs/superpowers/plans/2026-05-07-adversary-agent-visual-smoke.png`.

- [ ] **Step 3: Commit and publish**

Run: `scripts/codex-git.ps1 checkout -b codex/tk-20-adversary-agent`, commit the branch, push, and open a PR with `codex` and `codex-automation` labels.

- [ ] **Step 4: Complete Linear**

Link the PR to TK-20, comment with verification evidence, wait for green checks, merge when clean, then move TK-20 to Done.

## Self-Review

- Spec coverage: The plan covers first-class agent routing, bounded adversary candidate generation, judge feedback, settings persistence, UI controls, smoke assertions, visual review, PR, and Linear completion.
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: `AdversaryAgentSettings`, `planAdversaryCandidates`, `recordAdversaryJudgeFeedback`, and provider id `adversary` are consistently named across tasks.

## Implementation Evidence

Run time: 2026-05-07T16:50:00-05:00.

Implemented:

- First-class `Adversary` chat-agent module with prompt builders, task detection, and Codi/GHCP/Cursor/Codex streaming delegation.
- Deterministic `adversaryAgent` service for settings validation, candidate planning, and judge feedback records.
- Durable `agent-browser.adversary-agent-settings` storage key.
- Provider selector entry, runtime routing, placeholders, provider summaries, Settings controls, App smoke coverage, and visual-smoke assertions.

Validation completed:

- `npm.cmd install --cache .npm-cache` completed dependency hydration with `0 vulnerabilities`.
- `npm.cmd --workspace agent-browser run test:coverage -- src/services/adversaryAgent.test.ts` passed.
- `npm.cmd --workspace agent-browser run test:coverage -- src/chat-agents/Adversary/index.test.ts src/chat-agents/index.test.ts` passed.
- `npm.cmd --workspace agent-browser run test:coverage -- src/App.smoke.test.tsx` passed.
- `npm.cmd --workspace agent-browser run test:coverage -- src/services/partnerAgentControlPlane.test.ts` passed after adding Adversary specialist coverage.
- `npm.cmd --workspace agent-browser run lint` passed.
- `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser` passed after rebase onto current `origin/main`, including source hygiene, eval validation/tests, extension lint/coverage/build, Agent Browser lint/coverage/build, audit, and visual smoke.

Visual evidence:

- `docs/superpowers/plans/2026-05-07-adversary-agent-visual-smoke.png`
