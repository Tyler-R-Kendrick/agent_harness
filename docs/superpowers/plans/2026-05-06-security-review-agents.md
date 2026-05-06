# Security Review Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class Agent Browser security review agents and scheduled vulnerability scan controls that produce severity-tagged findings, remediation guidance, and prompt context for review and automation workflows.

**Architecture:** Add a specialized `security` chat-agent provider alongside `researcher`, `debugger`, and `planner`, backed by the same model runtime selection. Keep deterministic policy, settings validation, run planning, and prompt context in a focused service under `agent-browser/src/services/securityReviewAgents.ts`; wire durable settings through `sessionState.ts` and render controls in the existing Settings panel.

**Tech Stack:** React 18, TypeScript, Vitest, Vite, Playwright visual smoke, existing Agent Browser session storage and chat-agent provider seams.

---

## Feature Implementation Plan

TK-54 asks for security reviewers that inspect pull-request diffs and scheduled repository state, emit inline severity-tagged findings with remediation guidance, integrate security tools through the harness tool layer, and deliver scheduled scan updates through existing review and automation surfaces.

The implementation will ship this as a narrow Agent Browser capability:

- A first-class `Security Review` specialist chat agent that can be selected manually and auto-routes security-review prompts.
- Durable security review settings for inline PR review, scheduled scans, severity threshold, cadence, MCP/security tool integration mode, Slack-style delivery readiness, and custom team instructions.
- A deterministic run-plan service that converts settings plus selected tool IDs into enabled reviewer/scanner agents, severity scope, tool requirements, scheduled-scan summary, and prompt context.
- Settings UI controls and smoke/visual coverage so users can inspect and change security reviewer behavior.
- Full repo verification through `npm.cmd run verify:agent-browser` and a PR with visual smoke evidence.

## Architecture-Aligned Technical Spec

### Files

- Create `agent-browser/src/services/securityReviewAgents.ts`
  - Owns `SecurityReviewAgentSettings`, severity/cadence/tool-mode types, defaults, validator, run-plan derivation, scheduled-scan update summary, and prompt-context rendering.
- Create `agent-browser/src/services/securityReviewAgents.test.ts`
  - Covers settings validation, run-plan derivation, disabled behavior, prompt context, and scheduled scan summaries.
- Create `agent-browser/src/chat-agents/Security/index.ts`
  - Owns `SECURITY_REVIEW_LABEL`, task detection, operating instructions, system/tool prompts, and runtime-backed streaming.
- Create `agent-browser/src/chat-agents/Security/index.test.ts`
  - Covers trigger detection, prompt content, tool prompt content, and missing-runtime errors.
- Modify `agent-browser/src/chat-agents/types.ts`
  - Add `security` to `AgentProvider`.
- Modify `agent-browser/src/chat-agents/index.ts`
  - Export Security helpers, route `security` provider through `streamSecurityReviewChat`, include it in display names, placeholders, summaries, task routing, and runtime-provider resolution.
- Modify `agent-browser/src/services/sessionState.ts`
  - Add `securityReviewAgentSettings` durable localStorage key.
- Modify `agent-browser/src/services/sessionState.test.ts`
  - Assert the storage key is present and stable.
- Modify `agent-browser/src/services/partnerAgentControlPlane.ts`
  - Include `Security Review` in specialist readiness rows so partner policy sees the new agent.
- Modify `agent-browser/src/services/partnerAgentControlPlane.test.ts`
  - Assert the security specialist row is present and ready when a backing runtime is available.
- Modify `agent-browser/src/App.tsx`
  - Hydrate security settings, derive a security run plan in ChatPanel and Settings, inject prompt context into chat turns, add provider selector entry, status/empty/error copy, provider validity, and Settings controls.
- Modify `agent-browser/src/App.smoke.test.tsx`
  - Assert Settings renders security review controls.
- Modify `agent-browser/scripts/visual-smoke.mjs`
  - Open Settings and assert security controls are visible before screenshot.
- Modify `agent-browser/src/App.css`
  - Add compact responsive styling for the security review settings card/list.

### Behavior

- Defaults:
  - enabled: true
  - inlinePrReview: true
  - scheduledScans: true
  - cadence: weekly
  - severityThreshold: medium
  - toolIntegration: harness-selected
  - deliveryChannels: app enabled, Slack disabled until configured
  - customInstructions: empty string
- Security task detection should trigger on phrases such as `security review`, `vulnerability scan`, `secret leak`, `auth regression`, `privacy`, `prompt injection`, and `unsafe auto approval`.
- Prompt context should be omitted when settings are disabled.
- Prompt context should include:
  - enabled reviewer/scanner agents
  - inline PR review state
  - scheduled scan cadence
  - severity threshold
  - selected security tool count
  - delivery channels
  - custom instructions when present
- UI should be mobile-friendly and keyboard accessible, using checkboxes/selects/textarea with labels.

## TDD Tasks

### Task 1: Security Review Service

**Files:**
- Create: `agent-browser/src/services/securityReviewAgents.ts`
- Create: `agent-browser/src/services/securityReviewAgents.test.ts`

- [ ] **Step 1: Write failing service tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SECURITY_REVIEW_AGENT_SETTINGS,
  buildSecurityReviewPromptContext,
  buildSecurityReviewRunPlan,
  buildScheduledSecurityScanUpdate,
  isSecurityReviewAgentSettings,
} from './securityReviewAgents';

describe('securityReviewAgents', () => {
  it('derives enabled reviewer and scanner agents with severity and tool readiness', () => {
    const plan = buildSecurityReviewRunPlan({
      settings: DEFAULT_SECURITY_REVIEW_AGENT_SETTINGS,
      selectedToolIds: ['mcp.sast.scan', 'secret-scan'],
    });

    expect(plan.enabled).toBe(true);
    expect(plan.agents.map((agent) => agent.id)).toEqual(['security-reviewer', 'vulnerability-scanner']);
    expect(plan.severityThreshold).toBe('medium');
    expect(plan.securityToolCount).toBe(2);
    expect(plan.deliverySummary).toBe('Agent Browser updates');
  });

  it('renders prompt context and scheduled scan updates from settings', () => {
    const plan = buildSecurityReviewRunPlan({
      settings: {
        ...DEFAULT_SECURITY_REVIEW_AGENT_SETTINGS,
        cadence: 'daily',
        severityThreshold: 'high',
        customInstructions: 'Prioritize OAuth callback handling.',
      },
      selectedToolIds: ['mcp.sca.audit'],
    });

    const context = buildSecurityReviewPromptContext(plan);
    const update = buildScheduledSecurityScanUpdate(plan, new Date('2026-05-06T12:00:00.000Z'));

    expect(context).toContain('Security review agents: enabled');
    expect(context).toContain('Severity threshold: high');
    expect(context).toContain('Custom instructions: Prioritize OAuth callback handling.');
    expect(update.title).toBe('Weekly security scan ready');
    expect(update.body).toContain('daily vulnerability scanner cadence');
  });

  it('validates persisted settings and omits disabled context', () => {
    expect(isSecurityReviewAgentSettings(DEFAULT_SECURITY_REVIEW_AGENT_SETTINGS)).toBe(true);
    expect(isSecurityReviewAgentSettings({ ...DEFAULT_SECURITY_REVIEW_AGENT_SETTINGS, cadence: 'hourly' })).toBe(false);

    const plan = buildSecurityReviewRunPlan({
      settings: { ...DEFAULT_SECURITY_REVIEW_AGENT_SETTINGS, enabled: false },
      selectedToolIds: [],
    });

    expect(plan.enabled).toBe(false);
    expect(buildSecurityReviewPromptContext(plan)).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test -- src/services/securityReviewAgents.test.ts`

Expected: FAIL because `./securityReviewAgents` does not exist.

- [ ] **Step 3: Implement minimal service**

Create the service with the exact exported functions/types used by the tests.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd --workspace agent-browser run test -- src/services/securityReviewAgents.test.ts`

Expected: PASS.

### Task 2: First-Class Security Chat Agent

**Files:**
- Create: `agent-browser/src/chat-agents/Security/index.ts`
- Create: `agent-browser/src/chat-agents/Security/index.test.ts`
- Modify: `agent-browser/src/chat-agents/types.ts`
- Modify: `agent-browser/src/chat-agents/index.ts`

- [ ] **Step 1: Write failing chat-agent tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  SECURITY_REVIEW_LABEL,
  buildSecurityReviewOperatingInstructions,
  buildSecurityReviewSystemPrompt,
  buildSecurityReviewToolInstructions,
  isSecurityReviewTaskText,
  streamSecurityReviewChat,
} from './index';

vi.mock('@huggingface/transformers', () => ({
  TextStreamer: class MockTextStreamer {},
}));

describe('security review agent', () => {
  it('builds operating instructions for review and scheduled scans', () => {
    expect(SECURITY_REVIEW_LABEL).toBe('Security Review');
    const instructions = buildSecurityReviewOperatingInstructions();
    expect(instructions).toContain('auth regressions');
    expect(instructions).toContain('prompt injection');
    expect(instructions).toContain('severity-tagged findings');
    expect(instructions).toContain('remediation');
  });

  it('detects security tasks and builds tool-aware prompts', () => {
    expect(isSecurityReviewTaskText('Run a security review for this PR.')).toBe(true);
    expect(isSecurityReviewTaskText('Check for prompt injection and unsafe auto approvals.')).toBe(true);
    expect(isSecurityReviewTaskText('Write a product tour.')).toBe(false);

    const systemPrompt = buildSecurityReviewSystemPrompt({ workspaceName: 'Agent Browser' });
    expect(systemPrompt).toContain('Active workspace: Agent Browser');
    expect(systemPrompt).toContain('Security Review Operating Instructions');

    const toolPrompt = buildSecurityReviewToolInstructions({
      workspaceName: 'Agent Browser',
      workspacePromptContext: 'Workspace rules.',
      descriptors: [{ id: 'secret-scan', label: 'Secret scan', description: 'Scan for exposed secrets.' }],
      selectedToolIds: ['secret-scan'],
    });
    expect(toolPrompt).toContain('Selected tool ids: secret-scan');
    expect(toolPrompt).toContain('Scan for exposed secrets.');
  });

  it('requires a backing runtime before streaming', async () => {
    await expect(streamSecurityReviewChat({
      runtimeProvider: 'ghcp',
      workspaceName: 'Agent Browser',
      workspacePromptContext: '',
      messages: [],
      latestUserInput: 'security review this diff',
    }, {})).rejects.toThrow('Security Review GHCP chat requires a modelId and sessionId.');

    await expect(streamSecurityReviewChat({
      runtimeProvider: 'codi',
      workspaceName: 'Agent Browser',
      workspacePromptContext: '',
      messages: [],
      latestUserInput: 'security review this diff',
    }, {})).rejects.toThrow('Security Review Codi chat requires a local model.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd --workspace agent-browser run test -- src/chat-agents/Security/index.test.ts`

Expected: FAIL because the Security agent module does not exist.

- [ ] **Step 3: Implement the Security agent and provider routing**

Mirror the Debugger specialist runtime pattern, adding `security` to provider types and index routing.

- [ ] **Step 4: Run focused chat-agent tests**

Run: `npm.cmd --workspace agent-browser run test -- src/chat-agents/Security/index.test.ts src/chat-agents/index.test.ts src/chat-agents/streamAgentChat.test.ts`

Expected: PASS.

### Task 3: App Settings And Prompt Context

**Files:**
- Modify: `agent-browser/src/services/sessionState.ts`
- Modify: `agent-browser/src/services/sessionState.test.ts`
- Modify: `agent-browser/src/services/partnerAgentControlPlane.ts`
- Modify: `agent-browser/src/services/partnerAgentControlPlane.test.ts`
- Modify: `agent-browser/src/App.tsx`
- Modify: `agent-browser/src/App.smoke.test.tsx`
- Modify: `agent-browser/scripts/visual-smoke.mjs`
- Modify: `agent-browser/src/App.css`

- [ ] **Step 1: Write failing integration/smoke tests**

Add an App smoke test that opens Settings and expects:

```ts
expect(screen.getByText('Security review agents')).toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: 'Security review agents' }));
expect(screen.getByLabelText('Enable security review agents')).toBeInTheDocument();
expect(screen.getByLabelText('Enable inline PR security review')).toBeInTheDocument();
expect(screen.getByLabelText('Enable scheduled vulnerability scans')).toBeInTheDocument();
expect(screen.getByLabelText('Security scan cadence')).toHaveValue('weekly');
expect(screen.getByLabelText('Minimum reported severity')).toHaveValue('medium');
expect(screen.getByText('Vulnerability Scanner')).toBeInTheDocument();
```

Add a session-state test assertion:

```ts
expect(STORAGE_KEYS.securityReviewAgentSettings).toBe('agent-browser.security-review-agent-settings');
```

Add a partner-control-plane assertion:

```ts
expect(plane.agentRows.find((row) => row.provider === 'security')).toMatchObject({
  label: 'Security Review',
  kind: 'specialist',
  ready: true,
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm.cmd --workspace agent-browser run test -- src/App.smoke.test.tsx src/services/sessionState.test.ts src/services/partnerAgentControlPlane.test.ts`

Expected: FAIL because storage/UI/provider support has not been wired.

- [ ] **Step 3: Implement UI, durable state, prompt context, and visual smoke assertions**

Wire the new service into App state, Settings, ChatPanel context, provider selector, and visual smoke script.

- [ ] **Step 4: Run focused tests and visual smoke**

Run:

```powershell
npm.cmd --workspace agent-browser run test -- src/services/securityReviewAgents.test.ts src/chat-agents/Security/index.test.ts src/App.smoke.test.tsx src/services/sessionState.test.ts src/services/partnerAgentControlPlane.test.ts
npm.cmd run visual:agent-browser
```

Expected: PASS and screenshot at `output/playwright/agent-browser-visual-smoke.png`.

### Task 4: Full Verification, PR, And Linear Closeout

**Files:**
- Modify: `docs/superpowers/plans/2026-05-06-security-review-agents.md`
- Add: `docs/superpowers/plans/2026-05-06-security-review-agents-visual-smoke.png`

- [ ] **Step 1: Run full repo gate**

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm.cmd run verify:agent-browser`

Expected: PASS.

- [ ] **Step 2: Copy visual evidence**

Run: `Copy-Item output/playwright/agent-browser-visual-smoke.png docs/superpowers/plans/2026-05-06-security-review-agents-visual-smoke.png`

- [ ] **Step 3: Commit, push, and open PR**

Run:

```powershell
./scripts/codex-git.ps1 switch -c codex/tk-54-security-review-agents
./scripts/codex-git.ps1 add agent-browser docs/superpowers/plans/2026-05-06-security-review-agents.md docs/superpowers/plans/2026-05-06-security-review-agents-visual-smoke.png
./scripts/codex-git.ps1 commit -m "feat: add security review agents"
./scripts/codex-git.ps1 push -u origin codex/tk-54-security-review-agents
./scripts/codex-gh.ps1 pr create --title "Add security review agents" --body-file docs/superpowers/plans/2026-05-06-security-review-agents.md --base main --head codex/tk-54-security-review-agents
./scripts/codex-gh.ps1 pr edit --add-label codex --add-label codex-automation
```

- [ ] **Step 4: Update Linear**

Add the PR link and validation evidence to TK-54, then move it to Done after the PR is open and the implementation is complete.

## One-Shot LLM Prompt

You are implementing Linear TK-54 in `agent-harness`, focused on `agent-browser`.

Build first-class security review agents and scheduled vulnerability scan controls. Follow TDD. Do not write production code until a failing test exists.

Implement:

1. `agent-browser/src/services/securityReviewAgents.ts`
   - Export durable settings defaults and validator.
   - Derive enabled `Security Reviewer` and `Vulnerability Scanner` agent rows from settings.
   - Track severity threshold, scan cadence, selected security tool count, delivery summary, prompt context, and scheduled-scan update copy.
2. `agent-browser/src/chat-agents/Security/index.ts`
   - Add `SECURITY_REVIEW_LABEL = 'Security Review'`.
   - Detect security review prompts.
   - Build operating instructions covering auth regressions, privacy/data handling, prompt injection, unsafe auto approvals, severity-tagged findings, remediation, evidence, and scheduled scans.
   - Stream through GHCP or Codi using the established Debugger specialist pattern.
3. Provider routing:
   - Add `security` to `AgentProvider`.
   - Export/reroute Security in `chat-agents/index.ts`.
   - Include display name, summary, placeholder, auto-routing, runtime resolution, and empty/error copy.
4. App state/UI:
   - Add `STORAGE_KEYS.securityReviewAgentSettings`.
   - Hydrate settings from durable localStorage.
   - Add a Settings section named `Security review agents` with checkboxes for enabling agents, inline PR review, scheduled vulnerability scans; selects for cadence and minimum severity; textarea for custom instructions; summary rows for Security Reviewer and Vulnerability Scanner.
   - Inject security prompt context into chat turns when enabled.
   - Add `security` to the provider dropdown.
5. Visual/tests:
   - Add focused service/chat-agent/session/partner/App smoke tests.
   - Update `agent-browser/scripts/visual-smoke.mjs` to assert the Security settings section.
   - Add compact responsive CSS.
   - Run `npm.cmd run verify:agent-browser`.
   - Copy the passing visual smoke screenshot into `docs/superpowers/plans/2026-05-06-security-review-agents-visual-smoke.png`.
   - Open a PR with `codex` and `codex-automation` labels, link it in Linear TK-54, and move TK-54 to Done.

Keep the implementation narrow and aligned with existing `Debugger`, `Partner agent control plane`, `Adversary tool review`, and `sessionState` patterns.

## Self-Review

- Spec coverage: The plan covers first-class specialist agents, scheduled scans, severity/remediation, security tool integration, delivery/readiness, durable settings, UI, visual smoke, verification, PR, and Linear closeout.
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: `SecurityReviewAgentSettings`, `security`, `Security Review`, storage key, and Settings control labels are used consistently across tasks.
