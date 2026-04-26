# Debugger Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class Debugger chat agent that performs structured root-cause analysis for code, product, operations, and cross-domain issues.

**Architecture:** Follow the existing Researcher pattern: implement the agent under `agent-browser/src/chat-agents/Debugger/`, route eligible prompts through `agent-browser/src/chat-agents/index.ts`, and expose the provider in `agent-browser/src/App.tsx`. Debugger reuses the current Codi/GHCP model adapters and staged tool pipeline while injecting a dedicated system prompt and tool instructions.

**Tech Stack:** React, TypeScript, Vitest, existing chat-agent adapters, staged tool pipeline.

---

## Feature Implementation Plan

1. Add a `Debugger` first-class agent module with deterministic prompt builders, task detection, and stream delegation to GHCP or Codi.
2. Extend the provider union, exports, display names, placeholders, provider summaries, runtime resolution, and task routing to include `debugger`.
3. Wire `Debugger` into `App.tsx` so manual selection, persisted provider validation, can-submit gating, model fallback messages, staged tool instructions, and process labels all work.
4. Add tests first for the module, provider helpers, stream routing, and App-level tool routing.
5. Validate with targeted Vitest runs, then `npm run verify:agent-browser`.
6. Run `npm run visual:agent-browser` and inspect the screenshot for the provider dropdown and shell layout because the change adds visible UI.

## Technical Spec

### Debugger behavior

The Debugger agent guides the model through a repeatable triage loop:

- Define the symptom, expected behavior, impact, affected scope, and urgency.
- Capture a timeline and recent changes before forming conclusions.
- Maintain explicit hypotheses with evidence for, evidence against, confidence, and next validation step.
- Separate mitigation from root-cause proof so users can recover service before full explanation when appropriate.
- Validate the suspected root cause with the smallest useful experiment, tool call, log check, reproduction, or rollback.
- Finish with findings, fix or mitigation, verification, unresolved risks, and follow-up prevention work.

Research grounding:

- Google SRE incident-response guidance emphasizes clear roles, early declaration/escalation, and a working record of debugging and mitigation.
- Google SRE postmortem examples show mitigation can be useful before every root-cause detail is known.
- OpenTelemetry-style observability practice supports combining logs, metrics, traces, and contextual evidence instead of relying on a single signal.

### Prompt contract

`buildDebuggerOperatingInstructions()` returns a markdown operating guide with Purpose, Goals, Constraints, Workflow, Evidence Model, and Deliverables.

`buildDebuggerSystemPrompt({ workspaceName })` calls `buildAgentSystemPrompt` with a debugging-specific goal and appends the operating instructions.

`buildDebuggerToolInstructions(...)` wraps `buildDebuggerSystemPrompt` with `buildToolInstructionsTemplate` so selected tool descriptors remain visible to the staged tool pipeline.

`isDebuggingTaskText(text)` returns true for troubleshooting/root-cause/incident/debugging language and false for ordinary chat.

### App contract

The provider dropdown lists `Debugger`. `debugger` can use GHCP when available, otherwise Codi when a local model is installed. When the user asks to debug, troubleshoot, diagnose, or root-cause an issue, `resolveAgentProviderForTask` auto-routes to Debugger unless a more specific Researcher trigger is present. Staged tool use passes Debugger operating instructions to the tool pipeline.

### One-Shot LLM Prompt

```text
You are implementing TK-25 Debugger Agent in C:\Users\conta\.codex\worktrees\fea5\agent-harness.

Use TDD. Add a first-class agent under agent-browser/src/chat-agents/Debugger/ and wire it through the existing chat-agent provider/routing layer. Do not create workspace .agents files.

Required behavior:
- Add Debugger prompt builders that guide cross-domain root-cause analysis: symptom definition, timeline, impact, hypotheses, evidence for/against, mitigation, validation, root cause, and follow-up prevention.
- Reuse the existing Codi and GHCP adapters, passing a Debugger system prompt exactly like Researcher does.
- Add provider union support for debugger in chat-agents/types.ts and agent-browser/src/App.tsx.
- Add display name, placeholder, provider summary, runtime resolution, persisted-provider validation, can-submit gate, model error text, tool-pipeline instructions, and process labels.
- Auto-route debugging/root-cause/troubleshooting/incident prompts to Debugger.
- Keep Researcher precedence for research/citation/evidence-source prompts.
- Add Vitest coverage for Debugger module behavior, helper routing, stream routing, and App-level tool instruction routing.

Verification:
- Run the targeted Debugger/chat-agent/App tests and confirm red before implementation, green after implementation.
- Run npm run verify:agent-browser.
- Run npm run visual:agent-browser and include the output screenshot in the PR description.
```

---

### Task 1: Debugger Module Tests

**Files:**
- Create: `agent-browser/src/chat-agents/Debugger/index.test.ts`
- Create: `agent-browser/src/chat-agents/Debugger/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  buildDebuggerOperatingInstructions,
  buildDebuggerSystemPrompt,
  buildDebuggerToolInstructions,
  isDebuggingTaskText,
} from './index';

describe('debugger', () => {
  it('builds first-class Debugger operating instructions', () => {
    const instructions = buildDebuggerOperatingInstructions();

    expect(instructions).toContain('# Debugger');
    expect(instructions).toContain('root-cause analysis');
    expect(instructions).toContain('hypotheses');
    expect(instructions).toContain('mitigation');
    expect(instructions).toContain('verification');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ../scripts/run-package-bin.mjs vitest run src/chat-agents/Debugger/index.test.ts` from `agent-browser`

Expected: FAIL because `./index` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `agent-browser/src/chat-agents/Debugger/index.ts` with exported prompt builders and detection, mirroring `Researcher`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node ../scripts/run-package-bin.mjs vitest run src/chat-agents/Debugger/index.test.ts`

Expected: PASS.

### Task 2: Provider Routing Tests

**Files:**
- Modify: `agent-browser/src/chat-agents/index.test.ts`
- Modify: `agent-browser/src/chat-agents/streamAgentChat.test.ts`
- Modify: `agent-browser/src/chat-agents/index.ts`
- Modify: `agent-browser/src/chat-agents/types.ts`

- [ ] **Step 1: Write failing tests**

Add assertions for Debugger display name, placeholder, provider summary, auto-route, and stream delegation.

- [ ] **Step 2: Run tests to verify failure**

Run: `node ../scripts/run-package-bin.mjs vitest run src/chat-agents/index.test.ts src/chat-agents/streamAgentChat.test.ts`

Expected: FAIL because `debugger` is not a valid provider.

- [ ] **Step 3: Implement routing**

Add `debugger` to `AgentProvider`, import/export Debugger functions, route `streamAgentChat`, and update helper functions.

- [ ] **Step 4: Run tests to verify pass**

Run: `node ../scripts/run-package-bin.mjs vitest run src/chat-agents/index.test.ts src/chat-agents/streamAgentChat.test.ts`

Expected: PASS.

### Task 3: App Integration Tests

**Files:**
- Modify: `agent-browser/src/App.test.tsx`
- Modify: `agent-browser/src/App.tsx`

- [ ] **Step 1: Write failing App test**

Add a test that submits a debugging prompt, verifies the provider switches to Debugger, and verifies staged tool instructions include `## Debugger Operating Instructions`.

- [ ] **Step 2: Run test to verify failure**

Run: `node ../scripts/run-package-bin.mjs vitest run src/App.test.tsx -t "routes debugging tasks through the first-class Debugger agent"`

Expected: FAIL because the provider and tool instructions are not wired.

- [ ] **Step 3: Implement App wiring**

Add Debugger to provider dropdown, validation list, readiness gates, runtime error messages, tool instructions, process labels, display names, and placeholders.

- [ ] **Step 4: Run test to verify pass**

Run: `node ../scripts/run-package-bin.mjs vitest run src/App.test.tsx -t "routes debugging tasks through the first-class Debugger agent"`

Expected: PASS.

### Task 4: Full Verification and PR

**Files:**
- Verify changed files.
- Update Linear with completion evidence.
- Open PR for `TK-25`.

- [ ] **Step 1: Run targeted tests**

Run: `node ../scripts/run-package-bin.mjs vitest run src/chat-agents/Debugger/index.test.ts src/chat-agents/index.test.ts src/chat-agents/streamAgentChat.test.ts src/App.test.tsx -t "Debugger|debugging|provider|streamAgentChat"`

Expected: PASS.

- [ ] **Step 2: Run full agent-browser verification**

Run: `npm run verify:agent-browser`

Expected: PASS with no warnings or audit issues.

- [ ] **Step 3: Run visual smoke**

Run: `npm run visual:agent-browser`

Expected: PASS and screenshot at `output/playwright/agent-browser-visual-smoke.png`.

- [ ] **Step 4: Create PR**

Run: create a branch using the Linear branch name `contacttylerkendrick/tk-25-debugger-agent`, commit the changes, push, and open a PR that links TK-25 and includes the visual smoke screenshot.

## Self-Review

- Spec coverage: module prompt contract, provider routing, App wiring, tests, verification, Linear/PR handoff are all covered.
- Placeholder scan: no TBD or unresolved implementation placeholders.
- Type consistency: provider name is consistently `debugger`; display label is consistently `Debugger`.
