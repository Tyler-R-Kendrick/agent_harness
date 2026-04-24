# Summary Diff For Linear Feature Generation

Baseline: no previous `.features/Summary.md` existed in this repo on this automation's first run.

Interpretation of diff:

- Every item below is a net-new candidate capability synthesized from the competitor survey.
- Each candidate is normalized so it can map cleanly into an `agent-browser` feature brief.
- Each candidate includes a one-shot implementation instruction block meant to seed a future Linear issue or agent task.

## Added Candidate Features

### A1. Project Instructions And Scoped Memory

- Why it exists: Multiple competitors now center durable project instructions plus scoped memory boundaries.
- Competitors: Codex, Claude Code, Claude Cowork, ChatGPT, OpenClaw
- Recommended shape for `agent-browser`: Support a repo/workspace instruction file, nested overrides, and an optional project-only memory mode.
- One-shot instruction:
  - "Add project-scoped instruction loading to agent-browser. Load a root instruction file plus nested overrides when working in subtrees. Add an optional project-only memory mode that restricts recall to the current workspace. Expose both features in the UI with clear precedence rules, and record the effective instruction sources in task metadata for debugging."

### A2. Skills And Workflow Packs

- Why it exists: Skills/plugins are the dominant extension pattern across competitors.
- Competitors: Hermes Agent, OpenClaw, Codex, Claude Code, Claude Cowork
- Recommended shape for `agent-browser`: Add a lightweight workflow-pack format that can register instructions, tools, prompts, and optional setup scripts.
- One-shot instruction:
  - "Implement workflow packs for agent-browser. A workflow pack should declare a name, description, optional instructions, tool requirements, and optional commands or prompts. Surface installed packs in the UI, allow project-local and user-wide scopes, and load full pack content only on activation to minimize context cost."

### A3. Parallel Subagents

- Why it exists: Parallel delegation is now common among top harnesses.
- Competitors: Hermes Agent, Codex, Claude Code, Claude Cowork, OpenClaw, GitHub Copilot
- Recommended shape for `agent-browser`: Add explicit subagent spawning, ownership boundaries, and result summarization.
- One-shot instruction:
  - "Add subagent orchestration to agent-browser. Support spawning isolated child agents with scoped instructions, optional tool restrictions, and explicit task ownership. Show child progress in the parent task view, store summaries on completion, and prevent write conflicts by making the UI surface ownership and touched files."

### A4. Scheduled Automations

- Why it exists: Scheduling appears across coding and knowledge-work competitors.
- Competitors: Hermes Agent, Codex, Claude Cowork, ChatGPT, OpenClaw
- Recommended shape for `agent-browser`: Add scheduled prompts with recurrence, notifications, and run history.
- One-shot instruction:
  - "Implement scheduled automations in agent-browser. Allow users to create one-off or recurring tasks against a workspace, choose notification channels, inspect run history, and pause or delete schedules. Runs should execute with the same instruction/memory settings as the originating workspace unless explicitly overridden."

### A5. Browser Build-Test-Verify Loop

- Why it exists: Browser-native verification is becoming tightly coupled with coding agents.
- Competitors: Claude in Chrome, OpenClaw, Claude Cowork
- Recommended shape for `agent-browser`: Make visual/browser verification a first-class post-edit step with artifacts.
- One-shot instruction:
  - "Add a build-test-verify workflow to agent-browser. After an implementation task completes, let the agent launch the browser, inspect the target page, capture screenshots, pull console/network errors, and attach verification artifacts to the task summary. Make this available as an explicit workflow rather than an undocumented convention."

### A6. Evidence Pane And Review Artifacts

- Why it exists: Trust surfaces are now product features.
- Competitors: Codex, Claude Code, GitHub Copilot, Claude Cowork, Claude in Chrome
- Recommended shape for `agent-browser`: Expose terminal output, test results, screenshots, and source citations in one review pane.
- One-shot instruction:
  - "Create an evidence pane in agent-browser that aggregates terminal logs, test outputs, changed files, screenshots, and browser diagnostics for each task. The pane should support deep links back to the originating action and produce a concise review summary that can be copied into a PR or issue."

### A7. Cross-Surface Session Handoff

- Why it exists: Leading harnesses no longer trap the user in a single surface.
- Competitors: Codex, Claude Code, GitHub Copilot, Hermes Agent, OpenClaw
- Recommended shape for `agent-browser`: Support handoff among browser UI, terminal, and background worker sessions.
- One-shot instruction:
  - "Implement session handoff in agent-browser so a task started in the browser can be resumed from a terminal session and vice versa. Preserve task history, current plan, effective instructions, and evidence. Add a clear 'continue elsewhere' affordance and mark the active surface to avoid user confusion."

### A8. Control Plane Dashboard

- Why it exists: Hermes, OpenClaw, Codex, and Claude Desktop all present some form of control plane.
- Competitors: Hermes Agent, OpenClaw, Codex, Claude Cowork
- Recommended shape for `agent-browser`: Add a dashboard for active tasks, scheduled runs, skills, memory status, and environment health.
- One-shot instruction:
  - "Build a control-plane dashboard for agent-browser. It should show active tasks, queued/scheduled runs, last verification status, installed workflow packs, workspace instruction sources, and environment health. Prioritize scanability over verbosity and make each panel drill into raw evidence when needed."

### A9. Visual Workspace Output

- Why it exists: Visual canvases and side panels are spreading.
- Competitors: OpenClaw, ChatGPT, Claude in Chrome, Claude Cowork
- Recommended shape for `agent-browser`: Add a richer workspace for multi-file plans, visual annotations, and task outputs.
- One-shot instruction:
  - "Introduce a visual workspace mode in agent-browser for tasks that produce more than chat text. Support plan cards, artifact previews, screenshots, and inline annotations over generated outputs. The mode should work for coding, research, and browser-verification tasks without duplicating the main conversation history."

### A10. Model Routing And Execution Profiles

- Why it exists: Model choice and runtime portability are strong recurring themes.
- Competitors: Hermes Agent, Codex, GitHub Copilot
- Recommended shape for `agent-browser`: Add named execution profiles that bundle model choice, effort level, permission posture, and runtime backend.
- One-shot instruction:
  - "Add execution profiles to agent-browser. A profile should capture model selection, reasoning effort, permission defaults, and runtime backend preferences. Allow per-task overrides, make the active profile visible in the task header, and persist profile definitions at user or project scope."

## Suggested Linear Prioritization

1. A6 Evidence Pane And Review Artifacts
2. A5 Browser Build-Test-Verify Loop
3. A3 Parallel Subagents
4. A1 Project Instructions And Scoped Memory
5. A4 Scheduled Automations
6. A8 Control Plane Dashboard
7. A7 Cross-Surface Session Handoff
8. A2 Skills And Workflow Packs
9. A10 Model Routing And Execution Profiles
10. A9 Visual Workspace Output
