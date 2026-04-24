# Researcher Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Researcher agent behavior to agent-browser that can use whatever research tools are available, cite evidence, rank sources, handle conflicts, and persist research artifacts under `.research/<task-id>/`.

**Architecture:** Add Researcher as a first-class chat agent under `agent-browser/src/chat-agents/Researcher/`, then route research tasks through that provider. Researcher can run on the currently available model runtime (GHCP when ready, otherwise Codi), injects research-specialized chat/tool prompts, and owns task IDs, `.research/` artifact paths, source quality scoring, conflict resolution, and markdown artifact rendering.

**Tech Stack:** TypeScript, Vitest, existing agent-browser prompt templates, existing workspace file shape, existing staged tool pipeline.

---

## Feature Implementation Plan

The Linear issue asks for a researcher agent that does not hard-code a single tool provider. The bounded implementation is:

- Recognize research prompts and route them to the first-class `researcher` chat-agent provider.
- Emit researcher-specific guidance that tells the model to seek authoritative sources first, use only currently available tools, cite provenance, score source quality, resolve conflicting claims, and persist research state to `.research/<task-id>/`.
- Provide deterministic research artifact helpers that can be used by the UI, tool pipeline, or future persistence tools.
- Do not install Researcher as a default workspace `.agents/<name>/AGENTS.md` file; workspace `.agents` files are user/project instructions, not Agent Browser's internal chat-agent implementation surface.
- Cover the new behavior with red/green Vitest cycles before production code.

## Technical Spec

### Files

- Create `agent-browser/src/chat-agents/Researcher/index.test.ts`: red tests for task artifact paths, source ranking, conflict resolution, routing, prompts, and markdown persistence output.
- Create `agent-browser/src/chat-agents/Researcher/index.ts`: first-class Researcher chat-agent module plus pure TypeScript helpers and types for research records.
- Modify `agent-browser/src/chat-agents/index.test.ts` and `agent-browser/src/App.test.tsx`: red tests for routing research requests through the Researcher provider and staged tool instructions.
- Modify `agent-browser/src/chat-agents/index.ts` and `agent-browser/src/App.tsx`: add `researcher` provider, runtime selection, display/placeholder behavior, and research-task auto-routing.
- Modify `agent-browser/src/services/agentPromptTemplates.test.ts`: red tests for `research` scenario resolution and researcher guidance.
- Modify `agent-browser/src/services/agentPromptTemplates.ts`: add `research` scenario and prompt section.

### Data Contracts

`ResearchTaskRecord` contains:

- `taskId`: normalized task identifier.
- `topic`: human-readable research topic.
- `artifactRoot`: `.research/<task-id>`.
- `artifactPath`: `.research/<task-id>/research.md`.
- `toolHints`: tool capability hints inferred from available tool descriptors or IDs.
- `sources`: ranked `ResearchSource[]`.
- `conflicts`: `ResearchConflictResolution[]`.
- `createdAt` and `updatedAt`.

`ResearchSource` contains URL/domain/title, evidence summary, retrieved date, optional published date, source kind, and numeric quality score.

Source scoring favors official/primary sources, authoritative documentation, recent updates, and direct evidence. It penalizes missing provenance and low-authority/forum content. Conflict resolution chooses the higher-quality source; if quality is close, the newer published/retrieved source wins.

### One-Shot LLM Prompt

```
Implement TK-18 Researcher in agent-browser.

Use TDD. First add failing Vitest tests for:
- resolving research prompts to a new `research` AgentScenario,
- building a researcher system prompt with provenance, citation, source quality, conflict resolution, recency, and `.research/<task-id>/research.md` persistence guidance,
- creating deterministic research task artifact paths,
- ranking authoritative and recent sources above weaker sources,
- resolving conflicts with quality first and recency as tie-breaker,
- rendering a markdown research artifact with topic, sources, conflicts, and citations.

Then implement:
- `agent-browser/src/chat-agents/Researcher/index.ts`,
- update `agent-browser/src/chat-agents/index.ts`,
- update `agent-browser/src/App.tsx`,
- update `agent-browser/src/services/agentPromptTemplates.ts`.

Keep the implementation pure TypeScript, minimal, and consistent with existing services. Do not add external dependencies. Run:
- `npm --workspace agent-browser run test -- agentPromptTemplates researcher`
- `npm run verify:agent-browser`
```

## TDD Plan

### Task 1: Research Prompt Scenario

**Files:**
- Modify: `agent-browser/src/services/agentPromptTemplates.test.ts`
- Modify: `agent-browser/src/services/agentPromptTemplates.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('resolves research prompts and builds researcher guidance', () => {
  expect(resolveAgentScenario('Research the current browser automation options with citations.')).toBe('research');

  const prompt = buildAgentSystemPrompt({
    workspaceName: 'Research',
    goal: 'Research browser automation options.',
    scenario: 'research',
  });

  expect(prompt).toContain('## Researcher Guidance');
  expect(prompt).toContain('authoritative sources first');
  expect(prompt).toContain('provenance');
  expect(prompt).toContain('.research/<task-id>/research.md');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace agent-browser run test -- agentPromptTemplates`

Expected: FAIL because `research` is not an `AgentScenario`.

- [ ] **Step 3: Write minimal implementation**

Add `research` to `AgentScenario`, implement `buildResearchTemplate()`, route it in `buildScenarioGuidance()`, and detect research/citation/source/provenance terms in `resolveAgentScenario()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace agent-browser run test -- agentPromptTemplates`

Expected: PASS.

### Task 2: First-Class Researcher Agent

**Files:**
- Create: `agent-browser/src/chat-agents/Researcher/index.test.ts`
- Create: `agent-browser/src/chat-agents/Researcher/index.ts`
- Modify: `agent-browser/src/chat-agents/index.test.ts`
- Modify: `agent-browser/src/chat-agents/index.ts`
- Modify: `agent-browser/src/App.test.tsx`
- Modify: `agent-browser/src/App.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
it('creates deterministic research task artifacts', () => {
  const task = createResearchTaskRecord({
    taskId: 'Browser Automation 2026',
    topic: 'Browser automation options',
    toolIds: ['cli', 'browser_navigate', 'web-search'],
    now: '2026-04-24T00:00:00.000Z',
  });

  expect(task.taskId).toBe('browser-automation-2026');
  expect(task.artifactRoot).toBe('.research/browser-automation-2026');
  expect(task.artifactPath).toBe('.research/browser-automation-2026/research.md');
  expect(task.toolHints).toEqual(['curl-or-cli', 'browser-use', 'web-search']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace agent-browser run test -- chat-agents App workspaceFiles`

Expected: FAIL because the `researcher` provider and Researcher module do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement deterministic task normalization, path creation, tool-hint inference, source scoring, source ranking, conflict resolution, markdown artifact rendering, Researcher system/tool prompts, provider routing, and automatic research-task selection.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace agent-browser run test -- chat-agents App workspaceFiles`

Expected: PASS.

### Task 3: Verification and Visual Review

**Files:**
- Verify generated screenshot: `output/playwright/agent-browser-visual-smoke.png`

- [ ] **Step 1: Run focused tests**

Run: `npm --workspace agent-browser run test -- chat-agents App workspaceFiles agentPromptTemplates`

Expected: PASS.

- [ ] **Step 2: Run full agent-browser verification**

Run: `npm run verify:agent-browser`

Expected: PASS with no warnings, including lint, coverage, build, audit, and visual smoke.

- [ ] **Step 3: Review screenshot**

Open `output/playwright/agent-browser-visual-smoke.png` and confirm no visual regression in the default Agent Browser shell.

## Self-Review

- Spec coverage: tool-agnostic research, citations, provenance, source quality ranking, conflict resolution, recency tie-breaking, and `.research/<task-id>/` artifacts are covered.
- Placeholder scan: no implementation placeholders are left in this plan.
- Type consistency: all named functions are introduced in `chat-agents/Researcher/index.ts`, `chat-agents/index.ts`, or already exist in `agentPromptTemplates.ts`.
