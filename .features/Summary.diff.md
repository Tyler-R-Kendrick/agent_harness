# Summary Diff For Linear Feature Generation

Updated: 2026-06-09
Baseline: `.features/Summary.md` refreshed through the 2026-06-07 OpenAI Symphony corpus.
Diff type: additive updates after the 2026-06-09 GitHub Copilot refresh

## Net new normalized features

### Added: Bidirectional agent canvases over editable work objects
- Why now: the refreshed GitHub Copilot corpus now has a much clearer first-party canvas contract for structured work objects, shared human-agent state, and agentic browsing inside the Copilot app.
- Research delta:
  - GitHub now defines canvases as bidirectional work surfaces shared by users, agents, and the app layer rather than as plain output panes
  - the Copilot app explicitly names plans, pull requests, browser sessions, terminals, release checklists, migration boards, incidents, spreadsheets, dashboards, cloud consoles, and workflow state as canvas-backed work objects
  - GitHub says the app should connect those canvases to the underlying artifact or runtime and enforce what actions are allowed, which is a stronger contract than generic transcript streaming
  - the same release ties that model to agentic browsing, cloud sessions, cloud automations, `/chronicle`, and shared Copilot CLI session continuity in `My work`
  - app sessions now expose explicit session modes plus reasoning-effort controls, which makes the canvas feel like the visible control surface for longer-running structured work

## Expanded normalized features

### Expanded: Hybrid local, worktree, and cloud execution portability
- Why now: the refreshed GitHub Copilot corpus adds a stronger execution-isolation and resume model than the current portability summary captured.
- Research delta:
  - GitHub now documents local sandboxes and cloud sandboxes as first-class Copilot execution targets instead of just separate products or hidden runtime details
  - cloud sandboxes can be stopped and resumed with snapshots that preserve files, environment variables, and in-progress work
  - the same sandbox model now spans Copilot CLI and Copilot app cloud sessions, so the execution plane is portable without losing identity or policy
  - GitHub also exposes enterprise sandbox-access policy and local filesystem or network policy controls, which turns portability into a governed runtime choice instead of a blind execution switch

### Expanded: Browser use and computer control
- Why now: the refreshed GitHub Copilot app and VS Code releases move browser control further toward self-verification workflows.
- Research delta:
  - the Copilot app release now says agents can drive the integrated browser by clicking, typing, and taking screenshots to verify UI changes end to end
  - the VS Code May release adds device emulation, richer screenshot capture, and favorite-page shortcuts inside the integrated browser
  - this pushes Copilot's browser surface from passive tab sharing toward a more inspectable test-and-evidence loop

## Linear-ready feature payloads

### Proposed Linear feature: Add bidirectional agent canvases with editable work-object surfaces
- Linear issue title:
  - `Add bidirectional agent canvases with editable work-object surfaces`
- Suggested problem statement:
  - `agent-browser` already streams chat, logs, and artifacts, but long-running work is still primarily supervised through transcript text and separate panels. Competitors are starting to make plans, browser sessions, terminals, and other work objects into first-class shared surfaces that both the agent and the human can update directly. GitHub Copilot now frames canvases as the place where intent becomes visible work: the agent updates the work object while it executes, the user can inspect and steer that same object, and the app enforces what actions are allowed against the underlying runtime. Without a canvas layer, agent-browser will keep hiding progress in chat noise and disconnected panes instead of turning active work into inspectable, steerable state. The product needs a bidirectional canvas system for structured work objects, with transcript events linked back to concrete object-state changes and agent actions.`
- One-shot instruction for an LLM:
  - Implement bidirectional canvases for `agent-browser`: add a canvas model for structured work objects such as plans, browser tasks, terminal runs, PR-prep checklists, and other long-running artifacts; let agents update canvas state incrementally while they work; let users inspect, edit, reorder, approve, redirect, and verify progress directly on the same surface; keep each canvas explicitly connected to the underlying runtime or artifact so permitted actions are enforced by type; link transcript messages and tool events back to concrete canvas-state changes; and make the canvas available across foreground, background, and remote sessions so longer tasks are supervised through visible object state instead of transcript-only status updates.
