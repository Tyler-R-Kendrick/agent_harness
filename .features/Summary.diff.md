# Summary Diff For Linear Feature Generation

Updated: 2026-04-30
Baseline: `.features/Summary.md` updated from the 2026-04-29 eleven-harness corpus.
Diff type: additive update after Cline research

## Net new normalized features

### Expanded: Parallel agent orchestration
- Why now: Cline shows that parallelism is now being packaged at two layers at once: read-only subagents for codebase research and branch-isolated worktrees for concurrent implementation.
- Research delta:
  - the official Subagents docs describe focused research agents with separate prompts, context windows, and token budgets
  - the official Worktrees docs recommend opening worktrees in new windows for parallel Cline sessions and show `cline --cwd ... -y ...` for concurrent CLI runs

### Expanded: Persistent memory plus project instructions
- Why now: Cline makes inspectable markdown memory a visible product feature rather than an informal community pattern.
- Research delta:
  - the official Memory Bank docs describe a structured documentation system for maintaining context across sessions
  - the memory model is explicitly paired with session resume and Plan mode, which strengthens the case for inspectable layered memory in agent-browser

### Expanded: Skills and reusable browser workflows
- Why now: Cline combines on-demand skills, markdown workflows, lifecycle hooks, and centrally managed enterprise `globalSkills`, which broadens the packaging story from local prompts to governed workflow distribution.
- Research delta:
  - the Skills docs describe progressive loading with metadata, instructions, and resources
  - the Workflows docs turn completed task sequences into reusable slash-command procedures
  - the `v3.80.0` release on April 22, 2026 added enterprise remote `globalSkills` with UI toggles and `alwaysEnabled` enforcement

### Expanded: External tool connectivity and actionability
- Why now: Cline's MCP surface is no longer just raw protocol support. It now includes marketplace discovery plus agent-assisted server creation and troubleshooting.
- Research delta:
  - the MCP overview points users to the Cline MCP Marketplace
  - the docs say Cline can help clone, configure, build, and debug MCP servers
  - MCP is available in both the extension and the CLI

### Added: Background execution without stealing focus
- Why now: Cline packages reversible background editing and background command execution as explicit product behavior, which is a better fit for long-lived browser-agent sessions than modal diff or terminal takeovers.
- Linear issue title:
  - `Keep browser-agent execution in the background`
- Suggested problem statement:
  - Browser-agent runs still interrupt the active editing surface too often, forcing users to babysit diffs and command panes instead of supervising asynchronously.
- One-shot instruction for an LLM:
  - Design and implement a background execution mode for browser-agent tasks that streams diffs, validation output, browser evidence, and status updates into a side timeline without stealing focus, while preserving rollback, approval checkpoints, and quick resume controls.

### Added: Enterprise-managed workflow packs and always-on skills
- Why now: Cline's April 22, 2026 `v3.80.0` release makes enterprise-managed `globalSkills` explicit, which is a clear pattern for centrally governed agent behavior.
- Linear issue title:
  - `Publish governed workflow packs for teams`
- Suggested problem statement:
  - Shared browser workflows are still too dependent on personal prompt lore, and teams lack a way to centrally publish, require, and update sanctioned workflow packs.
- One-shot instruction for an LLM:
  - Build governed workflow packs with central publishing, team-scoped distribution, always-on enforcement, versioned rollout, and a local inspector so workspace admins can require specific browser-agent skills or procedures without hiding them from users.

### Added: Parallel worktree sessions for browser-agent tasks
- Why now: Cline turns Git worktrees into a visible parallel-session primitive instead of leaving branch isolation as an advanced manual trick.
- Linear issue title:
  - `Launch browser-agent tasks into isolated worktrees`
- Suggested problem statement:
  - Browser-agent coding tasks still compete for one working directory, which makes concurrent implementation and review harder than it should be.
- One-shot instruction for an LLM:
  - Add a worktree launcher for browser-agent tasks that can create or reuse branch-isolated environments, open them in parallel sessions, copy required local config, and surface merge-back guidance plus verification state in the parent workspace.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Keep browser-agent execution in the background`
2. `Publish governed workflow packs for teams`
3. `Launch browser-agent tasks into isolated worktrees`
