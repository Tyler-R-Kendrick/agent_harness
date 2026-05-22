# Summary Diff For Linear Feature Generation

Updated: 2026-05-22
Baseline: `.features/Summary.md` refreshed from the 2026-05-21 ChatGPT-updated corpus.
Diff type: additive update after Claude Code feature refresh

## Net new normalized features

### Added: Background session supervisor views with peek-and-reply control
- Why now: the refreshed Claude Code corpus shows a more explicit background-agent supervision model, where users can inspect active runs, peek into progress, and send follow-up steering without dropping back into each underlying terminal or branch environment.
- Research delta:
  - Claude Code now documents Agent View as a first-class surface for active and completed background sessions with peek and reply controls
  - Anthropic pairs that supervision layer with git worktree isolation, so concurrent runs stay inspectable without collapsing into one shared branch or shell
  - the GitHub Actions path extends the same harness into remote CI execution, which increases the need for a single control plane that can surface status and intervention points
  - remote control docs reinforce that the run should stay steerable across surfaces instead of becoming a fire-and-forget batch job

### Expanded: Multi-surface continuity
- Why now: the Claude Code refresh makes the continuity story more operational than the older notes captured by threading terminal, web, IDE, remote control, and GitHub Actions into one harness rather than treating them as separate entry points.
- Research delta:
  - users can start in a local terminal, supervise through Agent View, and continue from another surface
  - remote control keeps an active local run open to follow-up instead of forcing a new session on the secondary device
  - GitHub Actions lets the same harness behavior run inside CI while remaining part of the broader Claude Code workflow

### Expanded: Git/PR-native execution
- Why now: the Claude Code refresh strengthens the repo-native story with worktree-backed parallelism and GitHub Actions automation rather than only terminal-based edits.
- Research delta:
  - concurrent runs are explicitly tied to isolated git worktrees
  - remote review and automation can happen through GitHub Actions
  - the same harness model now spans local coding, branch isolation, and remote review loops

### Added: Add a background session supervisor with peek, reply, and blocked-state control
- Why now: `agent-browser` has multiple session and automation concepts already, but it still lacks a lightweight control plane that lets users supervise long-running runs, peek at progress, and steer or unblock them without context-switching into every underlying session.
- Linear issue:
  - Pending external publication in this session if the Linear plugin remains non-callable in this environment; the feature brief below is the canonical issue payload
- Linear issue title:
  - `Add a background session supervisor with peek, reply, and blocked-state control`
- Suggested problem statement:
  - `agent-browser` can launch sessions and preserve run history, but it still does not give users a compact supervisor view for active and background work. As runs get longer, move into worktrees or remote environments, or require human follow-up, users need a way to see what is running, what is blocked, and what needs intervention without opening each session in full. Without that control plane, long-running agent work becomes harder to trust, steer, and recover.`
- One-shot instruction for an LLM:
  - Implement a background session supervisor for `agent-browser` that lists active and completed runs across local, worktree, automation, and remote-capable execution modes; show current stage, recent events, branch or workspace identity, and explicit blocked or needs-input status; support lightweight peek and follow-up reply actions without forcing a full session switch; and preserve the same run transcript, artifacts, approvals, and diff context when the user drills in or takes over locally.
