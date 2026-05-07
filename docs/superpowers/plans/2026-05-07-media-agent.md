# Media Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class Agent Browser Media agent that orchestrates image, voice, SFX, music, and Remotion video generation workflows and recommends missing model installs.

**Architecture:** Media is a specialist model-backed chat agent under `agent-browser/src/chat-agents/Media/`, routed like Planner/Researcher/Debugger/Security. Deterministic media request classification and capability planning live in `agent-browser/src/services/mediaAgent.ts` so UI, prompts, and tests can reuse the same source of truth.

**Tech Stack:** React, TypeScript, Vitest, Vite, Playwright visual smoke, Vercel AI SDK chat abstractions, existing Agent Browser local/GHCP/Cursor runtime routing.

---

## Linear Description

TK-7 asks for an orchestrator agent that uses subagents to generate different media/file types because each media type has a different verifiable workflow. The minimum subagents are image generation, voice generation, SFX generation, music generation, and video generation through Remotion. The agent must know which models are available and prompt the user to install recommended models when required asset capabilities are missing.

## Feature Implementation Plan

1. Add a deterministic media capability planner.
2. Add a first-class Media chat-agent module.
3. Route explicit and inferred media-generation requests to the Media agent.
4. Surface Media in the provider selector, provider summary, input placeholder, Settings, App smoke tests, and visual smoke checks.
5. Validate with focused tests, full Agent Browser verification, and screenshot evidence.

## Architecture-Aligned Technical Spec

### Data Model

`agent-browser/src/services/mediaAgent.ts` owns:

```ts
export type MediaAssetKind = 'image' | 'voice' | 'sfx' | 'music' | 'video';
export type MediaCapabilityStatus = 'ready' | 'missing';

export interface MediaCapabilityRequirement {
  kind: MediaAssetKind;
  label: string;
  requiredModels: string[];
  recommendedInstall: string;
  verificationWorkflow: string;
}

export interface MediaCapabilityPlan {
  requestedKinds: MediaAssetKind[];
  requirements: MediaCapabilityRequirement[];
  ready: MediaCapabilityRequirement[];
  missing: MediaCapabilityRequirement[];
  installPrompt: string | null;
}
```

The planner treats installed local model ids/tags and remote model names as capability evidence. It returns a missing capability prompt instead of blocking on an unavailable runtime.

### Agent Module

`agent-browser/src/chat-agents/Media/index.ts` exports:

```ts
export const MEDIA_AGENT_ID = 'media';
export const MEDIA_LABEL = 'Media';
export function isMediaTaskText(text: string): boolean;
export function buildMediaOperatingInstructions(): string;
export function buildMediaSystemPrompt(input: { workspaceName?: string; modelId?: string; capabilityPlan?: MediaCapabilityPlan }): string;
export function buildMediaToolInstructions(input: ToolInstructionInput): string;
export async function streamMediaChat(input: StreamMediaInput, callbacks: AgentStreamCallbacks, signal?: AbortSignal): Promise<void>;
```

`streamMediaChat` delegates to GHCP, Cursor, or Codi exactly like the existing specialist agents, but prefixes the model prompt with the deterministic capability plan.

### UI Contract

The provider selector includes `Media`. Composer readiness treats Media as a specialist provider backed by GHCP, Cursor, or Codi. Settings gets a compact `Media agent` section that lists the five workflows and the install recommendations visible to users before they prompt the agent.

### Test Contract

Unit tests must prove:

- media request inference recognizes image, voice, SFX, music, and Remotion/video requests;
- capability planning separates ready and missing kinds;
- install prompts name concrete recommended models/tools;
- Media prompt builders include orchestration, subagent, install, and verification requirements;
- provider helpers display, summarize, route, and choose runtimes for `media`;
- App renders Media in the selector and Settings.

## One-Shot LLM Prompt

```text
You are implementing Linear TK-7 in agent-browser. Add a first-class Media agent.

Follow existing Agent Browser specialist-agent patterns:
- Add `agent-browser/src/services/mediaAgent.ts` with pure TypeScript capability planning for image, voice, sfx, music, and video assets.
- Add `agent-browser/src/chat-agents/Media/index.ts` and tests. Export Media constants, task detection, operating instructions, prompt builders, tool instructions, and a stream wrapper that delegates to GHCP/Cursor/Codi.
- Wire Media through `agent-browser/src/chat-agents/index.ts`, `types.ts`, provider display/placeholder/summary/routing/runtime helpers, and `streamAgentChat`.
- Update `agent-browser/src/App.tsx` so the provider selector includes Media, composer readiness/error text treats it like a model-backed specialist agent, and Settings exposes the Media workflow/readiness recommendations.
- Add App smoke and visual-smoke assertions for the Media selector/settings surface.
- Save screenshot evidence under `docs/superpowers/plans/2026-05-07-media-agent-visual-smoke.png`.

Use TDD. Write failing tests before production changes. Run focused tests first, then `npm.cmd run verify:agent-browser`. Keep the implementation narrow and aligned with the current architecture.
```

## TDD Task Plan

### Task 1: Media Capability Planner

**Files:**
- Create: `agent-browser/src/services/mediaAgent.ts`
- Create: `agent-browser/src/services/mediaAgent.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
expect(inferRequestedMediaKinds('generate an image and a sound effect')).toEqual(['image', 'sfx']);
expect(planMediaCapabilities({
  request: 'make a narrated Remotion launch video with music',
  installedModels: [{ id: 'cv/image-gen', name: 'Image model', task: 'image-generation', tags: ['image-generation'] }],
  remoteModelNames: ['GPT-4.1'],
}).missing.map((item) => item.kind)).toEqual(['voice', 'music', 'video']);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/services/mediaAgent.test.ts`
Expected: FAIL because `mediaAgent.ts` does not exist.

- [ ] **Step 3: Implement the planner**

Create request inference, five static capability requirements, model evidence matching, and install prompt rendering.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/services/mediaAgent.test.ts`
Expected: PASS.

### Task 2: First-Class Media Chat Agent

**Files:**
- Create: `agent-browser/src/chat-agents/Media/index.ts`
- Create: `agent-browser/src/chat-agents/Media/index.test.ts`
- Modify: `agent-browser/src/chat-agents/index.ts`
- Modify: `agent-browser/src/chat-agents/types.ts`
- Modify: `agent-browser/src/chat-agents/index.test.ts`

- [ ] **Step 1: Write failing chat-agent tests**

```ts
expect(isMediaTaskText('Create an image and voiceover')).toBe(true);
expect(buildMediaOperatingInstructions()).toContain('Remotion');
expect(getAgentDisplayName({ provider: 'media', researcherRuntimeProvider: 'ghcp', activeGhcpModelName: 'GPT-4.1' })).toBe('Media: GPT-4.1');
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/chat-agents/Media/index.test.ts src/chat-agents/index.test.ts`
Expected: FAIL because Media is not exported or routable.

- [ ] **Step 3: Implement Media agent routing**

Add Media to the provider union, export it, route media prompts before generic providers, and stream through GHCP/Cursor/Codi with Media system instructions.

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/chat-agents/Media/index.test.ts src/chat-agents/index.test.ts`
Expected: PASS.

### Task 3: App UI and Visual Coverage

**Files:**
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.smoke.test.tsx`
- Modify: `agent-browser/scripts/visual-smoke.mjs`

- [ ] **Step 1: Write failing UI tests**

```ts
fireEvent.click(screen.getByLabelText('Settings'));
expect(screen.getByText('Media agent')).toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: 'Media agent' }));
expect(screen.getByText('Image generation')).toBeInTheDocument();
expect(screen.getByText('Remotion video')).toBeInTheDocument();
```

- [ ] **Step 2: Run the UI tests and verify RED**

Run: `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx`
Expected: FAIL because the Media settings panel is not rendered.

- [ ] **Step 3: Implement UI**

Add provider option, composer readiness/error copy, Settings panel, and visual-smoke assertions/screenshots.

- [ ] **Step 4: Run the UI tests and verify GREEN**

Run: `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx`
Expected: PASS.

### Task 4: Full Verification and Publication

**Files:**
- Add screenshot: `docs/superpowers/plans/2026-05-07-media-agent-visual-smoke.png`

- [ ] **Step 1: Run focused gates**

Run:

```powershell
npm.cmd --workspace agent-browser run test -- src/services/mediaAgent.test.ts src/chat-agents/Media/index.test.ts src/chat-agents/index.test.ts src/App.smoke.test.tsx
npm.cmd --workspace agent-browser run lint
npm.cmd run visual:agent-browser
```

- [ ] **Step 2: Run full gate**

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`
Expected: generated-file check, eval validation/tests, script tests, lint, coverage, build, audit, and visual smoke all pass.

- [ ] **Step 3: Publish**

Use `scripts/codex-git.ps1` and `scripts/codex-gh.ps1` to commit, push `codex/tk-7-media-agent`, open a PR, add `codex` and `codex-automation` labels, link TK-7, wait for green checks, merge, and move TK-7 to Done.

## Self-Review

- Spec coverage: all five required media subagents are represented as capability requirements, prompt instructions, UI rows, and tests.
- Placeholder scan: no TBD/TODO/fill-later language remains.
- Type consistency: `MediaAssetKind`, `MediaCapabilityPlan`, `MEDIA_LABEL`, and `provider: 'media'` are used consistently across service, agent, routing, and UI.
