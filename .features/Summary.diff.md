# Summary Diff For Linear Feature Generation

Updated: 2026-05-16
Baseline: `.features/Summary.md` refreshed from the 2026-05-15 Hermes-updated corpus.
Diff type: additive update after Codex feature refresh

## Net new normalized features

### Added: Hybrid local, worktree, and cloud execution portability
- Why now: the refreshed Codex corpus shows OpenAI turning execution mode into an explicit product axis instead of a hidden implementation detail.
- Research delta:
  - Codex app threads now expose explicit `Local`, `Worktree`, and `Cloud` modes
  - the app docs now describe local projects versus dedicated worktrees for automations, not just for interactive threads
  - the IDE can start a cloud task from `main` or from local changes, then load that task back into the editor for local continuation
  - current remote-connections docs show the same host threads, approvals, diffs, screenshots, plugins, browser state, and tools being supervised from ChatGPT mobile
  - current product framing makes context-preserving handoff between execution environments a first-class user workflow

### Expanded: Scheduled automations and background execution
- Why now: Codex automations are more operationally structured than the earlier high-level launch story implied.
- Research delta:
  - automation runs can route findings into a Triage inbox or auto-archive when nothing needs attention
  - project-scoped automations can run in the local checkout or a dedicated background worktree
  - Codex supports custom cron schedules and thread-bound automations
  - skills can be triggered directly inside automations with `$skill-name`

### Expanded: Browser use and computer control
- Why now: Codex now exposes both page-scoped browser control and app-scoped desktop control as documented product surfaces.
- Research delta:
  - the in-app browser supports visual comments on specific rendered elements or regions
  - Browser plugin actions can click, type, inspect, screenshot, and verify inside the in-app browser
  - Computer Use requires explicit plugin installation plus app-level approval and OS-level permissions
  - the product keeps browser use and computer use under narrower trust boundaries than generic unrestricted remote control

### Expanded: Git/PR-native execution
- Why now: Codex’s GitHub integration is now a clearer reviewer-plus-remediator loop.
- Research delta:
  - `@codex review` triggers high-signal PR review focused on P0 and P1 issues
  - repositories can enable automatic reviews for every PR
  - `AGENTS.md` review guidance is applied per changed file using closest-scope instructions
  - follow-up commands such as `@codex fix the P1 issue` turn review findings into cloud-backed remediation tasks

### Added: Add hybrid local, worktree, and cloud execution modes with remote follow-through
- Why now: `agent-browser` already has sessions, worktrees, and evidence surfaces, but it still does not provide one thread model that can move cleanly between local execution, isolated worktrees, hosted runs, and remote supervision without splitting the user experience.
- Linear issue:
  - `TK-65`
- Linear issue title:
  - `Add hybrid local, worktree, and cloud execution modes with remote follow-through`
- Suggested problem statement:
  - `agent-browser` can open local sessions and worktrees, but it does not yet let one agent run start locally, move into an isolated or hosted environment, keep the same thread and artifacts, return for local finishing, and remain steerable from remote supervision surfaces without forcing the user to mentally stitch together multiple sessions.
- One-shot instruction for an LLM:
  - Implement execution-mode portability for `agent-browser` so a run can start in the local workspace, be promoted into an isolated worktree or remote/cloud environment, keep the same thread identity and artifact history, and return for local review or finishing work; wire this into session storage, worktree management, remote-control surfaces, approval state, and diff/evidence rendering so users can supervise one continuous task instead of juggling separate disconnected sessions.
